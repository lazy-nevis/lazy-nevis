import type { CalendarEntry, CalendarKind } from "@/types";
import { dayBoundsMs, endOfLocalDay, parseDateKey, toDateKey } from "./calendarMath";

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const HOURS_PER_DAY = 24;
export const DEFAULT_SCROLL_HOUR = 7;
export const HOUR_HEIGHT_PX = 48;

export interface TimedBlockInput {
  id: string;
  entryId: string;
  kind: "session" | "pomodoro_run";
  startMs: number;
  endMs: number;
}

export interface LaidOutBlock {
  id: string;
  entryId: string;
  kind: "session" | "pomodoro_run";
  startMs: number;
  endMs: number;
  column: number;
  columnCount: number;
  topRatio: number;
  heightRatio: number;
}

export interface PointMarker {
  id: string;
  entryId: string;
  kind: CalendarKind;
  atMs: number;
  label: string;
  tone: string;
}

export interface AllDayChip {
  id: string;
  entryId: string;
  kind: CalendarKind;
  label: string;
  tone: string;
}

/** Clip an interval to local day bounds; returns null when no overlap. */
export function clipIntervalToDay(
  dateKey: string,
  startMs: number,
  endMs: number,
): { startMs: number; endMs: number } | null {
  const { startMs: dayStart } = dayBoundsMs(dateKey);
  const dayEnd = endOfLocalDay(parseDateKey(dateKey));
  const start = Math.max(startMs, dayStart);
  const end = Math.min(endMs, dayEnd);
  if (start >= end) return null;
  return { startMs: start, endMs: end };
}

export function msToDayRatio(ms: number, dateKey: string): number {
  const { startMs: dayStart } = dayBoundsMs(dateKey);
  return (ms - dayStart) / MS_PER_DAY;
}

/** Side-by-side columns for overlapping timed blocks within one day. */
export function layoutTimedBlocks(
  dateKey: string,
  blocks: TimedBlockInput[],
): LaidOutBlock[] {
  const clipped: TimedBlockInput[] = [];
  for (const block of blocks) {
    const c = clipIntervalToDay(dateKey, block.startMs, block.endMs);
    if (!c) continue;
    clipped.push({ ...block, startMs: c.startMs, endMs: c.endMs });
  }
  clipped.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  const placed: { block: TimedBlockInput; column: number }[] = [];
  for (const block of clipped) {
    const overlapping = placed.filter(
      (p) => p.block.endMs > block.startMs && p.block.startMs < block.endMs,
    );
    const used = new Set(overlapping.map((p) => p.column));
    let column = 0;
    while (used.has(column)) column += 1;
    placed.push({ block, column });
  }

  return placed.map(({ block, column }) => {
    const cluster = placed.filter(
      (p) => p.block.endMs > block.startMs && p.block.startMs < block.endMs,
    );
    const columnCount = Math.max(...cluster.map((p) => p.column), 0) + 1;
    const topRatio = msToDayRatio(block.startMs, dateKey);
    const bottomRatio = msToDayRatio(block.endMs, dateKey);
    return {
      id: block.id,
      entryId: block.entryId,
      kind: block.kind,
      startMs: block.startMs,
      endMs: block.endMs,
      column,
      columnCount,
      topRatio,
      heightRatio: Math.max(bottomRatio - topRatio, 1 / HOURS_PER_DAY / 4),
    };
  });
}

/** Mirror backend session clipping across local midnights (for tests + client reuse). */
export function splitTimedRangeAcrossDays(
  startMs: number,
  endMs: number,
): { dateKey: string; startMs: number; endMs: number }[] {
  const out: { dateKey: string; startMs: number; endMs: number }[] = [];
  let cursor = startMs;
  while (cursor < endMs) {
    const dateKey = toDateKey(new Date(cursor));
    const clip = clipIntervalToDay(dateKey, cursor, endMs);
    if (!clip) break;
    out.push({ dateKey, ...clip });
    cursor = endOfLocalDay(parseDateKey(dateKey)) + 1;
  }
  return out;
}

function entryOnDate(entry: CalendarEntry, dateKey: string): boolean {
  const key = (ms: number) => new Date(ms).toLocaleDateString("en-CA");
  switch (entry.kind) {
    case "session":
    case "pomodoro_run":
      return key(entry.segment_start_ms) === dateKey || key(entry.segment_end_ms) === dateKey;
    case "checklist_completed":
      return key(entry.completed_at) === dateKey;
    case "checklist_due":
      return key(entry.due_date) === dateKey;
    case "habit_log":
      return key(entry.logged_at) === dateKey;
    case "habit_day":
      return entry.date === dateKey;
    case "reminder_occurrence":
      return key(entry.scheduled_for) === dateKey;
    default:
      return false;
  }
}

export function partitionEntriesForDay(
  dateKey: string,
  entries: CalendarEntry[],
  visibleKinds: CalendarKind[],
): { blocks: TimedBlockInput[]; markers: PointMarker[]; allDay: AllDayChip[] } {
  const blocks: TimedBlockInput[] = [];
  const markers: PointMarker[] = [];
  const allDay: AllDayChip[] = [];

  for (const entry of entries) {
    if (!visibleKinds.includes(entry.kind) || !entryOnDate(entry, dateKey)) continue;
    switch (entry.kind) {
      case "session":
        blocks.push({
          id: entry.id,
          entryId: entry.id,
          kind: "session",
          startMs: entry.segment_start_ms,
          endMs: entry.segment_end_ms,
        });
        break;
      case "pomodoro_run":
        blocks.push({
          id: entry.id,
          entryId: entry.id,
          kind: "pomodoro_run",
          startMs: entry.segment_start_ms,
          endMs: entry.segment_end_ms,
        });
        break;
      case "checklist_due":
        allDay.push({
          id: entry.id,
          entryId: entry.id,
          kind: entry.kind,
          label: entry.title,
          tone: entry.tone ?? "emerald",
        });
        break;
      case "habit_day":
        allDay.push({
          id: entry.id,
          entryId: entry.id,
          kind: entry.kind,
          label: entry.habit_name,
          tone: entry.tone,
        });
        break;
      case "checklist_completed":
        markers.push({
          id: entry.id,
          entryId: entry.id,
          kind: entry.kind,
          atMs: entry.completed_at,
          label: entry.title,
          tone: entry.tone ?? "emerald",
        });
        break;
      case "habit_log":
        markers.push({
          id: entry.id,
          entryId: entry.id,
          kind: entry.kind,
          atMs: entry.logged_at,
          label: entry.habit_name,
          tone: entry.tone,
        });
        break;
      case "reminder_occurrence":
        markers.push({
          id: entry.id,
          entryId: entry.id,
          kind: entry.kind,
          atMs: entry.scheduled_for,
          label: entry.title,
          tone: entry.tone,
        });
        break;
      default:
        break;
    }
  }

  return { blocks, markers, allDay };
}

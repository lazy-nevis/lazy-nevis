import type { CalendarEntry, CalendarKind, CalendarView } from "@/types";

const MS_DAY = 24 * 60 * 60 * 1000;

export interface GridDay {
  date: string;
  inMonth: boolean;
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local `YYYY-MM-DD` for an epoch ms. Avoids `toLocaleDateString`, which is slow in WebKit. */
export function msToDateKey(ms: number): string {
  return toDateKey(new Date(ms));
}

/** Local date an entry is filed under (timed entries use their start). */
export function entryDateKey(entry: CalendarEntry): string {
  switch (entry.kind) {
    case "session":
    case "pomodoro_run":
      return msToDateKey(entry.segment_start_ms);
    case "checklist_completed":
      return msToDateKey(entry.completed_at);
    case "checklist_due":
      return msToDateKey(entry.due_date);
    case "habit_log":
      return msToDateKey(entry.logged_at);
    case "habit_day":
      return entry.date;
    case "reminder_occurrence":
      return msToDateKey(entry.scheduled_for);
    default:
      return "";
  }
}

/** True when the entry falls on `dateKey`; timed entries also match the day they end on. */
export function entryOnDate(entry: CalendarEntry, dateKey: string): boolean {
  if (entryDateKey(entry) === dateKey) return true;
  return (
    (entry.kind === "session" || entry.kind === "pomodoro_run") &&
    msToDateKey(entry.segment_end_ms) === dateKey
  );
}

/** Buckets entries by `entryDateKey`, keeping their order. */
export function groupEntriesByDate(entries: CalendarEntry[]): Map<string, CalendarEntry[]> {
  const out = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const key = entryDateKey(entry);
    const bucket = out.get(key);
    if (bucket) bucket.push(entry);
    else out.set(key, [entry]);
  }
  return out;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(y, m - 1, d);
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfLocalDay(d: Date): number {
  const start = startOfLocalDay(d).getTime();
  return start + MS_DAY - 1;
}

export function dayBoundsMs(dateKey: string): { startMs: number; endMs: number } {
  const startMs = parseDateKey(dateKey).getTime();
  return { startMs, endMs: startMs + MS_DAY - 1 };
}

export function startOfMonth(anchor: Date): Date {
  return new Date(anchor.getFullYear(), anchor.getMonth(), 1);
}

export function monthGrid(anchor: Date, weekStart: 0 | 1): GridDay[] {
  const first = startOfMonth(anchor);
  const startDow = first.getDay();
  const offset = (startDow - weekStart + 7) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - offset);
  const out: GridDay[] = [];
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    out.push({
      date: toDateKey(day),
      inMonth: day.getMonth() === anchor.getMonth(),
    });
  }
  return out;
}

export function weekDateKeys(anchor: Date, weekStart: 0 | 1): string[] {
  const day = startOfLocalDay(anchor);
  const dow = day.getDay();
  const offset = (dow - weekStart + 7) % 7;
  const weekStartDate = new Date(day);
  weekStartDate.setDate(day.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartDate);
    d.setDate(weekStartDate.getDate() + i);
    return toDateKey(d);
  });
}

export function rangeForView(
  view: CalendarView,
  anchor: Date,
  weekStart: 0 | 1,
): { fromMs: number; toMs: number } {
  if (view === "month") {
    const grid = monthGrid(anchor, weekStart);
    const from = parseDateKey(grid[0].date).getTime();
    const to = endOfLocalDay(parseDateKey(grid[grid.length - 1].date));
    return { fromMs: from, toMs: to };
  }
  if (view === "week") {
    const keys = weekDateKeys(anchor, weekStart);
    const from = parseDateKey(keys[0]).getTime();
    const to = endOfLocalDay(parseDateKey(keys[keys.length - 1]));
    return { fromMs: from, toMs: to };
  }
  const from = startOfLocalDay(anchor).getTime();
  const to = endOfLocalDay(anchor);
  return { fromMs: from, toMs: to };
}

export function shiftAnchor(anchor: Date, view: CalendarView, delta: number): Date {
  const next = new Date(anchor);
  if (view === "month") {
    next.setMonth(next.getMonth() + delta);
    return next;
  }
  if (view === "week") {
    next.setDate(next.getDate() + delta * 7);
    return next;
  }
  next.setDate(next.getDate() + delta);
  return next;
}

/** Local `once` rule datetime for “new reminder on this day”. */
export function defaultReminderOnceAt(dateKey: string): string {
  const now = new Date();
  const isToday = toDateKey(now) === dateKey;
  let hour = 9;
  let minute = 0;
  if (isToday) {
    hour = Math.min(23, now.getHours() + 1);
    minute = 0;
  }
  return `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function isTodayKey(dateKey: string): boolean {
  return toDateKey(new Date()) === dateKey;
}

/** Free-text fields of an entry (labels, titles, habit names). */
export function entryText(entry: CalendarEntry): string {
  switch (entry.kind) {
    case "session":
    case "pomodoro_run":
      return entry.label ?? "";
    case "habit_log":
    case "habit_day":
      return entry.habit_name;
    case "checklist_completed":
    case "checklist_due":
    case "reminder_occurrence":
      return entry.title;
    default:
      return "";
  }
}

/** Case- and accent-insensitive match on the entry text or its localized kind label. */
export function entryMatchesQuery(
  entry: CalendarEntry,
  query: string,
  kindLabel: (kind: CalendarKind) => string,
): boolean {
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const needle = normalize(query.trim());
  if (!needle) return true;
  return normalize(`${entryText(entry)} ${kindLabel(entry.kind)}`).includes(needle);
}

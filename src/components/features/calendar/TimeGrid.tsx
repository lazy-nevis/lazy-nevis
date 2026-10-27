import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarEntry, CalendarKind } from "@/types";
import { cn } from "@/utils/cn";
import { formatTime } from "@/utils/formatters";
import { toneStyle, toTone } from "@/utils/tones";
import { calendarKindTone } from "./calendarKindTone";
import { isTodayKey, parseDateKey } from "./calendarMath";
import {
  DEFAULT_SCROLL_HOUR,
  HOUR_HEIGHT_PX,
  HOURS_PER_DAY,
  MS_PER_DAY,
  layoutTimedBlocks,
  partitionEntriesForDay,
  type LaidOutBlock,
  type PointMarker,
} from "./calendarLayout";

export interface TimeGridProps {
  dateKeys: string[];
  entries: CalendarEntry[];
  visibleKinds: CalendarKind[];
  selectedDate: string | null;
  locale: string;
  onSelectDate: (dateKey: string, anchor: HTMLElement) => void;
  onSessionClick?: (sessionId: string) => void;
}

export function TimeGrid({
  dateKeys,
  entries,
  visibleKinds,
  selectedDate,
  locale,
  onSelectDate,
  onSessionClick,
}: TimeGridProps) {
  const { t } = useTranslation(undefined, { keyPrefix: "calendar" });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: DEFAULT_SCROLL_HOUR * HOUR_HEIGHT_PX });
  }, [dateKeys.join(",")]);

  const columns = useMemo(
    () =>
      dateKeys.map((dateKey) => {
        const { blocks, markers, allDay } = partitionEntriesForDay(
          dateKey,
          entries,
          visibleKinds,
        );
        return {
          dateKey,
          laidOut: layoutTimedBlocks(dateKey, blocks),
          markers,
          allDay,
        };
      }),
    [dateKeys, entries, visibleKinds],
  );

  const gridHeight = HOURS_PER_DAY * HOUR_HEIGHT_PX;
  const refDay = parseDateKey(dateKeys[0] ?? toDateKeyLocal());

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div
        className="grid border-b border-border bg-muted/30"
        style={{ gridTemplateColumns: `3.5rem repeat(${dateKeys.length}, minmax(0, 1fr))` }}
      >
        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{t("all_day")}</div>
        {columns.map((col) => (
          <button
            key={`allday-${col.dateKey}`}
            type="button"
            onClick={(event) => onSelectDate(col.dateKey, event.currentTarget)}
            className={cn(
              "min-h-8 border-l border-border px-1 py-1 text-left",
              selectedDate === col.dateKey && "bg-primary/5",
            )}
          >
            <div className="flex flex-wrap gap-1">
              {col.allDay.map((chip) => (
                <span
                  key={chip.id}
                  className="tone-soft max-w-full truncate rounded px-1.5 py-0.5 text-[10px]"
                  style={toneStyle(toTone(chip.tone))}
                  title={chip.label}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
      <div ref={scrollRef} className="max-h-[32rem] overflow-y-auto">
        <div className="flex" style={{ height: gridHeight }}>
          <div className="relative w-14 shrink-0 border-r border-border bg-card">
            {Array.from({ length: HOURS_PER_DAY }, (_, hour) => {
              const labelMs = refDay.getTime() + hour * 3_600_000;
              return (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-border/60 pr-1 text-right text-[10px] text-muted-foreground"
                  style={{ top: hour * HOUR_HEIGHT_PX, height: HOUR_HEIGHT_PX }}
                >
                  <span className="-translate-y-2 inline-block bg-card px-0.5">
                    {formatTime(labelMs, locale)}
                  </span>
                </div>
              );
            })}
          </div>
          <div
            className="grid min-w-0 flex-1"
            style={{ gridTemplateColumns: `repeat(${dateKeys.length}, minmax(0, 1fr))` }}
          >
            {columns.map((col) => (
              <div
                key={col.dateKey}
                className={cn(
                  "relative border-l border-border",
                  isTodayKey(col.dateKey) && "bg-primary/5",
                  selectedDate === col.dateKey && "ring-1 ring-inset ring-primary/30",
                )}
              >
                <button
                  type="button"
                  className="absolute right-1 top-1 z-10 rounded bg-card/80 px-1 text-[10px] text-muted-foreground"
                  onClick={(event) => onSelectDate(col.dateKey, event.currentTarget)}
                >
                  {col.dateKey.slice(5)}
                </button>
                {Array.from({ length: HOURS_PER_DAY }, (_, hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-border/40"
                    style={{ top: hour * HOUR_HEIGHT_PX }}
                  />
                ))}
                {col.laidOut.map((block) => (
                  <TimedBlock
                    key={block.id}
                    block={block}
                    entries={entries}
                    onSessionClick={onSessionClick}
                  />
                ))}
                {col.markers.map((marker) => (
                  <PointMarkerDot
                    key={marker.id}
                    marker={marker}
                    dateKey={col.dateKey}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function toDateKeyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function TimedBlock({
  block,
  entries,
  onSessionClick,
}: {
  block: LaidOutBlock;
  entries: CalendarEntry[];
  onSessionClick?: (sessionId: string) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "calendar" });
  const entry = entries.find((e) => e.id === block.entryId);
  const tone = entry ? calendarKindTone(entry.kind, entry) : "slate";
  const label =
    entry?.kind === "session"
      ? (entry.label ?? t("session_unnamed"))
      : entry?.kind === "pomodoro_run"
        ? (entry.label ?? t("pomodoro_block"))
        : "";
  const widthPct = 100 / block.columnCount;
  const leftPct = block.column * widthPct;
  const clickable = entry?.kind === "session" && onSessionClick;

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => {
        if (entry?.kind === "session") onSessionClick?.(entry.session_id);
      }}
      className={cn(
        "absolute z-[1] overflow-hidden rounded border px-1 py-0.5 text-left text-[10px] leading-tight tone-border",
        clickable && "hover:brightness-110",
        !clickable && "cursor-default",
      )}
      style={{
        ...toneStyle(toTone(tone)),
        top: `${block.topRatio * 100}%`,
        height: `${block.heightRatio * 100}%`,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
      }}
      title={label}
    >
      <span className="line-clamp-3 font-medium">{label}</span>
    </button>
  );
}

function PointMarkerDot({
  marker,
  dateKey,
}: {
  marker: PointMarker;
  dateKey: string;
}) {
  const dayStart = parseDateKey(dateKey).getTime();
  const ratio = (marker.atMs - dayStart) / MS_PER_DAY;
  return (
    <span
      className="absolute z-[2] h-2 w-2 -translate-x-1/2 rounded-full tone-dot"
      style={{
        ...toneStyle(toTone(marker.tone)),
        top: `${ratio * 100}%`,
        left: "50%",
      }}
      title={marker.label}
    />
  );
}

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarDay, CalendarEntry, CalendarKind } from "@/types";
import { cn } from "@/utils/cn";
import { calendarKindTone } from "@/components/features/calendar/calendarKindTone";
import { toneStyle } from "@/utils/tones";
import type { GridDay } from "./calendarMath";
import { groupEntriesByDate, isTodayKey } from "./calendarMath";

const KIND_ORDER: CalendarKind[] = [
  "session",
  "pomodoro_run",
  "habit_day",
  "checklist_completed",
  "checklist_due",
  "reminder_occurrence",
];

export interface MonthGridProps {
  grid: GridDay[];
  days: CalendarDay[];
  entries: CalendarEntry[];
  visibleKinds: CalendarKind[];
  weekStart: 0 | 1;
  selectedDate: string | null;
  onSelectDate: (date: string, anchor: HTMLElement) => void;
}

function dayMarkers(dayEntries: CalendarEntry[], visibleKinds: CalendarKind[]) {
  return KIND_ORDER.flatMap((kind) => {
    if (!visibleKinds.includes(kind)) return [];
    const count = dayEntries.filter((e) => e.kind === kind).length;
    return count > 0 ? [{ kind, count }] : [];
  });
}

export function MonthGrid({
  grid,
  days,
  entries,
  visibleKinds,
  weekStart,
  selectedDate,
  onSelectDate,
}: MonthGridProps) {
  const { t } = useTranslation(undefined, { keyPrefix: "calendar" });
  const entriesByDate = useMemo(() => groupEntriesByDate(entries), [entries]);
  const summaryByDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const weekdayLabels = weekStart === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {weekdayLabels.map((d) => (
          <div key={d} className="py-2">
            {t(`weekdays.short.${d}`)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((cell, index) => {
          const dayEntries = entriesByDate.get(cell.date) ?? [];
          const summary = summaryByDate.get(cell.date);
          const markers = dayMarkers(dayEntries, visibleKinds);
          const today = isTodayKey(cell.date);
          const selected = selectedDate === cell.date;
          const sampleEntry = dayEntries[0];
          const visibleMarkers = markers.slice(0, 3);
          const hiddenKinds = Math.max(0, markers.length - visibleMarkers.length);
          return (
            <button
              key={cell.date}
              type="button"
              aria-pressed={selected}
              aria-label={cell.date}
              onClick={(event) => onSelectDate(cell.date, event.currentTarget)}
              className={cn(
                "group relative flex min-h-[6.25rem] flex-col gap-1 border-border p-1.5 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                index % 7 !== 6 && "border-r",
                index < grid.length - 7 && "border-b",
                cell.inMonth ? "hover:bg-accent/50" : "bg-muted/25 text-muted-foreground/70",
                selected && "bg-brand/5 ring-2 ring-inset ring-brand/50",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums",
                    today && "bg-brand text-brand-foreground",
                  )}
                >
                  {Number(cell.date.slice(8))}
                </span>
                {summary && summary.habits_due > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] font-medium tabular-nums",
                      summary.habits_met >= summary.habits_due
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {t("habit_ring", {
                      met: summary.habits_met,
                      due: summary.habits_due,
                    })}
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                {visibleMarkers.map((m) => {
                  const tone = calendarKindTone(m.kind, sampleEntry);
                  return (
                    <span
                      key={m.kind}
                      className="tone-soft flex min-w-0 items-center gap-1 rounded px-1 py-px text-[10px] font-medium leading-4"
                      style={toneStyle(tone)}
                    >
                      <span className="tone-dot h-1.5 w-1.5 shrink-0 rounded-full" style={toneStyle(tone)} />
                      <span className="truncate">{t(`kinds.${m.kind}`)}</span>
                      <span className="ml-auto tabular-nums opacity-80">{m.count}</span>
                    </span>
                  );
                })}
                {hiddenKinds > 0 && (
                  <span className="px-1 text-[10px] text-muted-foreground">+{hiddenKinds}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

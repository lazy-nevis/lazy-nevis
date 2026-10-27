import { useTranslation } from "react-i18next";
import type { CalendarDay, CalendarEntry, CalendarKind } from "@/types";
import { cn } from "@/utils/cn";
import { calendarKindTone } from "@/components/features/calendar/calendarKindTone";
import { toneStyle } from "@/utils/tones";
import type { GridDay } from "./calendarMath";
import { isTodayKey } from "./calendarMath";

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
  onSelectDate: (date: string) => void;
}

function daySummary(
  date: string,
  days: CalendarDay[],
  entries: CalendarEntry[],
  visibleKinds: CalendarKind[],
) {
  const summary = days.find((d) => d.date === date);
  const dayEntries = entries.filter(
    (e) => entryDate(e) === date && visibleKinds.includes(entryKind(e)),
  );
  const markers = KIND_ORDER.flatMap((kind) => {
    const count = dayEntries.filter((e) => entryKind(e) === kind).length;
    return count > 0 ? [{ kind, count }] : [];
  });
  return { summary, markers, overflow: Math.max(0, markers.length - 4) };
}

function entryKind(entry: CalendarEntry): CalendarKind {
  return entry.kind;
}

function entryDate(entry: CalendarEntry): string {
  switch (entry.kind) {
    case "session":
    case "pomodoro_run":
      return new Date(entry.segment_start_ms).toLocaleDateString("en-CA");
    case "checklist_completed":
      return new Date(entry.completed_at).toLocaleDateString("en-CA");
    case "checklist_due":
      return new Date(entry.due_date).toLocaleDateString("en-CA");
    case "habit_log":
      return new Date(entry.logged_at).toLocaleDateString("en-CA");
    case "habit_day":
      return entry.date;
    case "reminder_occurrence":
      return new Date(entry.scheduled_for).toLocaleDateString("en-CA");
    default:
      return "";
  }
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
  const weekdayLabels = weekStart === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {weekdayLabels.map((d) => (
          <div key={d}>{t(`weekdays.short.${d}`)}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell) => {
          const { summary, markers, overflow } = daySummary(
            cell.date,
            days,
            entries,
            visibleKinds,
          );
          const today = isTodayKey(cell.date);
          const selected = selectedDate === cell.date;
          const sampleEntry = entries.find((e) => entryDate(e) === cell.date);
          const visibleMarkers = markers.slice(0, 4);
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => onSelectDate(cell.date)}
              className={cn(
                "flex min-h-[4.5rem] flex-col rounded-lg border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                cell.inMonth ? "bg-card" : "bg-muted/20 text-muted-foreground",
                today && "ring-2 ring-primary/40",
                selected && "border-primary",
              )}
            >
              <span className="text-xs font-medium">{cell.date.slice(8)}</span>
              {summary && summary.habits_due > 0 && (
                <span className="mt-0.5 text-[10px] text-muted-foreground">
                  {t("habit_ring", {
                    met: summary.habits_met,
                    due: summary.habits_due,
                  })}
                </span>
              )}
              <div className="mt-1 flex flex-wrap gap-0.5">
                {visibleMarkers.map((m) => {
                  const tone = calendarKindTone(m.kind, sampleEntry);
                  return (
                    <span
                      key={m.kind}
                      className="tone-dot h-1.5 w-1.5 rounded-full"
                      style={toneStyle(tone)}
                      title={t(`kinds.${m.kind}`)}
                    />
                  );
                })}
                {overflow > 0 && (
                  <span className="text-[10px] text-muted-foreground">+{overflow}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

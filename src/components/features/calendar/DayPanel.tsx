import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CalendarEntry, CalendarKind } from "@/types";
import { formatDurationHuman, formatPercent, formatTime } from "@/utils/formatters";
import { calendarKindTone } from "@/components/features/calendar/calendarKindTone";
import { toneStyle, toTone } from "@/utils/tones";
import { cn } from "@/utils/cn";

export interface DayPanelProps {
  dateKey: string;
  entries: CalendarEntry[];
  visibleKinds: CalendarKind[];
  locale: string;
  onClose: () => void;
  onSessionClick: (sessionId: string) => void;
  onNewReminder: () => void;
}

/** Content of the floating day popover: only non-empty sections, plus a "new reminder" action. */
export function DayPanel({
  dateKey,
  entries,
  visibleKinds,
  locale,
  onClose,
  onSessionClick,
  onNewReminder,
}: DayPanelProps) {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: "calendar" });

  const title = useMemo(() => {
    const parsed = new Date(`${dateKey}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return dateKey;
    return parsed.toLocaleDateString(i18n.language, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [dateKey, i18n.language]);

  const sections = useMemo(() => {
    const filtered = entries.filter((e) => visibleKinds.includes(e.kind) && onDate(e, dateKey));
    return [
      { key: "sessions", items: filtered.filter((e) => e.kind === "session") },
      { key: "pomodoro", items: filtered.filter((e) => e.kind === "pomodoro_run") },
      {
        key: "habits",
        items: filtered.filter((e) => e.kind === "habit_day" || e.kind === "habit_log"),
      },
      {
        key: "checklist",
        items: filtered.filter(
          (e) => e.kind === "checklist_completed" || e.kind === "checklist_due",
        ),
      },
      { key: "reminders", items: filtered.filter((e) => e.kind === "reminder_occurrence") },
    ].filter((section) => section.items.length > 0);
  }, [dateKey, entries, visibleKinds]);

  const renderRow = (entry: CalendarEntry) => {
    switch (entry.kind) {
      case "session":
        return <SessionRow key={entry.id} entry={entry} locale={locale} onSessionClick={onSessionClick} />;
      case "pomodoro_run":
        return <PomodoroRow key={entry.id} entry={entry} locale={locale} />;
      case "habit_day":
      case "habit_log":
        return <HabitRow key={entry.id} entry={entry} locale={locale} />;
      case "checklist_completed":
      case "checklist_due":
        return <ChecklistRow key={entry.id} entry={entry} />;
      case "reminder_occurrence":
        return <ReminderRow key={entry.id} entry={entry} locale={locale} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex w-[22rem] max-w-[calc(100vw-1rem)] flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold capitalize">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {t("day_count", { count: sections.reduce((n, s) => n + s.items.length, 0) })}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-1 h-7 w-7"
          onClick={onClose}
          aria-label={t("close_panel")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea viewportClassName="max-h-[min(22rem,60vh)]" contentClassName="space-y-4 px-4 py-3">
        {sections.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("day_empty")}</p>
        ) : (
          sections.map((section) => (
            <div key={section.key}>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`sections.${section.key}`)}
              </h4>
              <div className="mt-1.5 space-y-1.5">{section.items.map(renderRow)}</div>
            </div>
          ))
        )}
      </ScrollArea>
      <div className="border-t border-border p-3">
        <Button type="button" variant="brand" size="sm" className="w-full gap-1.5" onClick={onNewReminder}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t("new_reminder_on_day")}
        </Button>
      </div>
    </div>
  );
}

function ToneChip({
  kind,
  entry,
  children,
  className,
}: {
  kind: CalendarKind;
  entry?: CalendarEntry;
  children: ReactNode;
  className?: string;
}) {
  const tone = calendarKindTone(kind, entry);
  return (
    <div
      className={cn("tone-soft rounded-md border border-transparent px-3 py-2 text-sm", className)}
      style={toneStyle(tone)}
    >
      {children}
    </div>
  );
}

function SessionRow({
  entry,
  locale,
  onSessionClick,
}: {
  entry: CalendarEntry;
  locale: string;
  onSessionClick: (sessionId: string) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "calendar" });
  if (entry.kind !== "session") return null;
  const tone = calendarKindTone("session", entry);
  return (
    <button
      type="button"
      className="w-full rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={toneStyle(tone)}
      onClick={() => onSessionClick(entry.session_id)}
    >
      <div className="font-medium">{entry.label ?? t("session_unnamed")}</div>
      <div className="text-xs text-muted-foreground">
        {t("session_row", {
          start: formatTime(entry.segment_start_ms, locale),
          end: formatTime(entry.segment_end_ms, locale),
          duration: formatDurationHuman(entry.segment_end_ms - entry.segment_start_ms),
          focus: formatPercent(entry.focus_percent),
        })}
      </div>
    </button>
  );
}

function PomodoroRow({ entry, locale }: { entry: CalendarEntry; locale: string }) {
  const { t } = useTranslation(undefined, { keyPrefix: "calendar" });
  if (entry.kind !== "pomodoro_run") return null;
  return (
    <ToneChip kind="pomodoro_run" entry={entry}>
      <div className="font-medium">{entry.label ?? t("pomodoro_block")}</div>
      <div className="text-xs text-muted-foreground">
        {t("pomodoro_entry", {
          start: formatTime(entry.segment_start_ms, locale),
          end: formatTime(entry.segment_end_ms, locale),
          cycles: entry.cycles_completed,
          focus: formatDurationHuman(entry.focus_ms, locale),
          status: t(`pomodoro_status.${entry.status}`),
        })}
      </div>
    </ToneChip>
  );
}

function HabitRow({ entry, locale }: { entry: CalendarEntry; locale: string }) {
  const { t } = useTranslation(undefined, { keyPrefix: "calendar" });
  if (entry.kind === "habit_day") {
    return (
      <ToneChip kind="habit_day" entry={entry}>
        {t("habit_day_entry", {
          name: entry.habit_name,
          status: t(`habit_status.${entry.status}`),
        })}
      </ToneChip>
    );
  }
  if (entry.kind === "habit_log") {
    return (
      <ToneChip kind="habit_log" entry={entry}>
        {t("habit_log_entry", {
          name: entry.habit_name,
          time: formatTime(entry.logged_at, locale),
        })}
      </ToneChip>
    );
  }
  return null;
}

function ChecklistRow({ entry }: { entry: CalendarEntry }) {
  const { t } = useTranslation(undefined, { keyPrefix: "calendar" });
  if (entry.kind === "checklist_completed") {
    return (
      <ToneChip kind="checklist_completed" entry={entry}>
        {t("checklist_completed_entry", {
          title: entry.title,
          status: t("completed"),
          late: entry.late ? t("late_suffix") : "",
        })}
      </ToneChip>
    );
  }
  if (entry.kind === "checklist_due") {
    return (
      <ToneChip kind="checklist_due" entry={entry}>
        {t("checklist_due_entry", {
          title: entry.title,
          status: entry.overdue ? t("overdue") : t("due"),
        })}
      </ToneChip>
    );
  }
  return null;
}

function ReminderRow({ entry, locale }: { entry: CalendarEntry; locale: string }) {
  const { t } = useTranslation(undefined, { keyPrefix: "calendar" });
  if (entry.kind !== "reminder_occurrence") return null;
  const tone = toTone(entry.tone);
  return (
    <div className="tone-soft rounded-md px-3 py-2 text-sm" style={toneStyle(tone)}>
      {t("reminder_entry", {
        title: entry.title,
        time: formatTime(entry.scheduled_for, locale),
        status: t(`reminder_status.${entry.status}`),
        late: entry.late ? t("late_suffix") : "",
      })}
    </div>
  );
}

function onDate(entry: CalendarEntry, dateKey: string): boolean {
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

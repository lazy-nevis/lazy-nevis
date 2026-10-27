import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
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
      month: "short",
      day: "numeric",
    });
  }, [dateKey, i18n.language]);

  const sections = useMemo(() => {
    const filtered = entries.filter((e) => visibleKinds.includes(e.kind) && onDate(e, dateKey));
    return {
      sessions: filtered.filter((e) => e.kind === "session"),
      pomodoro: filtered.filter((e) => e.kind === "pomodoro_run"),
      habits: filtered.filter((e) => e.kind === "habit_day" || e.kind === "habit_log"),
      checklist: filtered.filter(
        (e) => e.kind === "checklist_completed" || e.kind === "checklist_due",
      ),
      reminders: filtered.filter((e) => e.kind === "reminder_occurrence"),
    };
  }, [dateKey, entries, visibleKinds]);

  return (
    <aside className="w-full max-w-md shrink-0 lg:sticky lg:top-6 lg:self-start">
      <SectionCard
        title={title}
        description={dateKey}
        className="flex max-h-[min(32rem,calc(100vh-6rem))] flex-col overflow-hidden shadow-md"
        actions={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t("close_panel")}
          >
            <X className="h-4 w-4" />
          </Button>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <PanelSection title={t("sections.sessions")} empty={sections.sessions.length === 0}>
            {sections.sessions.map((e) => (
              <SessionRow key={e.id} entry={e} locale={locale} onSessionClick={onSessionClick} />
            ))}
          </PanelSection>
          <PanelSection title={t("sections.pomodoro")} empty={sections.pomodoro.length === 0}>
            {sections.pomodoro.map((e) => (
              <PomodoroRow key={e.id} entry={e} locale={locale} />
            ))}
          </PanelSection>
          <PanelSection title={t("sections.habits")} empty={sections.habits.length === 0}>
            {sections.habits.map((e) => (
              <HabitRow key={e.id} entry={e} locale={locale} />
            ))}
          </PanelSection>
          <PanelSection title={t("sections.checklist")} empty={sections.checklist.length === 0}>
            {sections.checklist.map((e) => (
              <ChecklistRow key={e.id} entry={e} />
            ))}
          </PanelSection>
          <PanelSection title={t("sections.reminders")} empty={sections.reminders.length === 0}>
            {sections.reminders.map((e) => (
              <ReminderRow key={e.id} entry={e} locale={locale} />
            ))}
          </PanelSection>
        </div>
        <div className="mt-4 shrink-0 border-t border-border/60 pt-4">
          <Button type="button" variant="brand" className="w-full" onClick={onNewReminder}>
            {t("new_reminder_on_day")}
          </Button>
        </div>
      </SectionCard>
    </aside>
  );
}

function PanelSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "calendar" });
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="mt-2 space-y-2">
        {empty ? <p className="text-sm text-muted-foreground">{t("section_empty")}</p> : children}
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

import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  ListChecks,
  Play,
  Target,
  Timer,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { formatProgressLine } from "@/components/features/habits/habitFormat";
import { habitIcon } from "@/components/features/habits/habitIcons";
import type { DashboardData } from "@/components/features/dashboard/useDashboardData";
import { useHabits } from "@/hooks/useHabits";
import { habitService } from "@/services/tauri";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import type { ChecklistItem } from "@/types";
import { cn } from "@/utils/cn";
import { formatDuration, formatDurationHuman, formatTime } from "@/utils/formatters";
import { toneColor, toneStyle, toTone, type Tone } from "@/utils/tones";

const HABIT_PREVIEW_COUNT = 3;

export function WidgetFrame({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex h-full flex-col rounded-xl border bg-card p-4 shadow-sm", className)}>
      <header className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 className="flex-1 truncate text-sm font-semibold">{title}</h2>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {action.label}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function HeroCard({
  tone,
  icon: Icon,
  title,
  description,
  status,
  cta,
  onClick,
}: {
  tone: Tone;
  icon: LucideIcon;
  title: string;
  description: string;
  status: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <article
      className="tone-border relative flex flex-col overflow-hidden rounded-2xl border bg-card p-5 shadow-sm"
      style={toneStyle(tone)}
    >
      <div className="pointer-events-none absolute inset-0 tone-glow opacity-90" aria-hidden />
      <div className="relative flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: toneColor(tone, 0.16), color: toneColor(tone) }}
        >
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <p className="relative mt-4 font-mono text-2xl font-semibold tabular-nums tracking-tight">
        {status}
      </p>
      <Button variant="outline" size="sm" className="relative mt-4 w-full gap-1.5" onClick={onClick}>
        {cta}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </article>
  );
}

export function HeroWidget({ data, openCount }: { data: DashboardData; openCount: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "overview" });
  const navigate = useNavigate();
  const activeSession = useSessionStore((s) => s.activeSession);
  const liveStats = useSessionStore((s) => s.liveStats);
  const setStartModalOpen = useUiStore((s) => s.setStartModalOpen);
  const pomodoro = data.pomodoro;
  const pomodoroRunning = Boolean(pomodoro?.run);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <HeroCard
        tone="orange"
        icon={Play}
        title={t("hero.sessions_title")}
        description={t("hero.sessions_desc")}
        status={activeSession ? formatDuration(liveStats?.total_ms ?? 0) : t("hero.idle")}
        cta={activeSession ? t("hero.sessions_open") : t("hero.sessions_start")}
        onClick={() => (activeSession ? navigate("/sessions") : setStartModalOpen(true))}
      />
      <HeroCard
        tone="rose"
        icon={Timer}
        title={t("hero.pomodoro_title")}
        description={t("hero.pomodoro_desc")}
        status={
          pomodoroRunning
            ? formatDuration(pomodoro?.remaining_ms ?? 0)
            : t("hero.pomodoro_today", {
                done: pomodoro?.today_completed ?? 0,
                goal: pomodoro?.daily_goal ?? 0,
              })
        }
        cta={pomodoroRunning ? t("hero.pomodoro_open") : t("hero.pomodoro_start")}
        onClick={() => navigate("/pomodoro")}
      />
      <HeroCard
        tone="emerald"
        icon={ListChecks}
        title={t("hero.checklist_title")}
        description={t("hero.checklist_desc")}
        status={t("hero.checklist_open", { count: openCount })}
        cta={t("hero.checklist_open_cta")}
        onClick={() => navigate("/checklist")}
      />
    </div>
  );
}

export function StatsWidget({
  data,
  checklistToday,
  checklistUpcoming,
}: {
  data: DashboardData;
  checklistToday: number;
  checklistUpcoming: number;
}) {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: "overview" });
  const { today } = useHabits();
  const activeSession = useSessionStore((s) => s.activeSession);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatCard
        icon={Play}
        label={t("stats.sessions_today")}
        value={data.sessionsToday.length}
        hint={t("stats.sessions_week", { count: data.sessionsWeekCount })}
      />
      <StatCard
        icon={Target}
        label={t("stats.focus_today")}
        value={formatDurationHuman(data.focusTodayMs, i18n.language)}
        hint={activeSession ? t("stats.session_active") : t("stats.session_none")}
      />
      <StatCard
        icon={ListChecks}
        label={t("stats.checklist_today")}
        value={checklistToday}
        hint={t("stats.upcoming", { count: checklistUpcoming })}
      />
      <StatCard
        icon={BellRing}
        label={t("stats.reminders_today")}
        value={data.remindersToday.length}
        hint={t("stats.upcoming", { count: data.remindersUpcoming.length })}
      />
      <StatCard
        icon={Check}
        label={t("stats.habits_met")}
        value={`${today?.met_count ?? 0}/${today?.total_active ?? 0}`}
      />
      <StatCard
        icon={Timer}
        label={t("stats.pomodoros")}
        value={`${data.pomodoro?.today_completed ?? 0}/${data.pomodoro?.daily_goal ?? 0}`}
      />
    </div>
  );
}

export function HabitsWidget() {
  const { t } = useTranslation(undefined, { keyPrefix: "overview" });
  const { t: th } = useTranslation(undefined, { keyPrefix: "habits" });
  const navigate = useNavigate();
  const { today } = useHabits();
  const cards = today?.cards ?? [];
  const preview = cards.slice(0, HABIT_PREVIEW_COUNT);

  return (
    <WidgetFrame
      title={t("habits.title")}
      icon={Target}
      action={{ label: t("habits.see_all", { count: cards.length }), onClick: () => navigate("/habits") }}
    >
      {preview.length === 0 ? (
        <EmptyState icon={Target} title={th("empty_today")} className="border-none bg-transparent py-3 shadow-none" />
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {preview.map(({ habit, progress, streak_current }) => {
            const tone = toTone(habit.tone);
            const percent = Math.min(100, Math.round(progress.percent));
            const met = progress.status === "met";
            const Icon = met ? Check : habitIcon(habit.icon);
            return (
              <li
                key={habit.id}
                className="tone-border flex flex-col gap-2 rounded-lg border bg-background/40 p-3"
                style={toneStyle(tone)}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={cn("h-4 w-4 shrink-0", met ? "text-success" : "text-muted-foreground")} aria-hidden />
                  <p className="flex-1 truncate text-sm font-medium">{habit.name}</p>
                  {streak_current > 0 && (
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {t("habits.streak", { count: streak_current })}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {formatProgressLine(progress.per_target)}
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${percent}%`, backgroundColor: toneColor(tone, 0.9) }}
                  />
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => void habitService.openQuickLog(habit.id)}
                >
                  {th("log")}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetFrame>
  );
}

export function MiniCalendarWidget({ data }: { data: DashboardData }) {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: "overview" });
  const navigate = useNavigate();
  const weekStart = useSettingsStore((s) => s.settings.general.week_start ?? 1);
  const now = new Date(data.todayStart);
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (first.getDay() - weekStart + 7) % 7;
  const activity = new Map(
    data.monthDays.map((day) => {
      const c = day.counts;
      const total =
        c.session + c.pomodoro_run + c.checklist_completed + c.checklist_due + c.habit_log + c.reminder_occurrence;
      return [day.date, total] as const;
    }),
  );
  const weekdayFmt = new Intl.DateTimeFormat(i18n.language, { weekday: "narrow" });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    weekdayFmt.format(new Date(2024, 0, 7 + ((i + weekStart) % 7))),
  );
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <WidgetFrame
      title={new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }).format(first)}
      icon={CalendarDays}
      action={{ label: t("calendar.open"), onClick: () => navigate("/calendar") }}
    >
      <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
        {weekdays.map((label, i) => (
          <span key={i} className="pb-1 font-medium text-muted-foreground">
            {label}
          </span>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const key = `${year}-${pad(month + 1)}-${pad(day)}`;
          const isToday = day === now.getDate();
          const count = activity.get(key) ?? 0;
          return (
            <span
              key={key}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-md tabular-nums",
                isToday ? "bg-brand font-semibold text-brand-foreground" : "text-foreground/80",
              )}
            >
              {day}
              {count > 0 && !isToday && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-brand" aria-hidden />
              )}
            </span>
          );
        })}
      </div>
    </WidgetFrame>
  );
}

export function ChecklistTodayWidget({ items }: { items: ChecklistItem[] }) {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: "overview" });
  const navigate = useNavigate();
  return (
    <WidgetFrame
      title={t("checklist.title")}
      icon={ListChecks}
      action={{ label: t("checklist.open"), onClick: () => navigate("/checklist") }}
    >
      {items.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">{t("checklist.empty")}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 6).map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" aria-hidden />
              <span className="flex-1 truncate">{item.title}</span>
              {item.due_has_time && item.due_date !== null && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatTime(item.due_date, i18n.language)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

export function RemindersTodayWidget({ data }: { data: DashboardData }) {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: "overview" });
  const navigate = useNavigate();
  const list = data.remindersToday.length > 0 ? data.remindersToday : data.remindersUpcoming;
  return (
    <WidgetFrame
      title={t("reminders.title")}
      icon={BellRing}
      action={{ label: t("reminders.open"), onClick: () => navigate("/reminders") }}
    >
      {list.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">{t("reminders.empty")}</p>
      ) : (
        <>
          {data.remindersToday.length === 0 && (
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("reminders.upcoming")}
            </p>
          )}
          <ul className="space-y-1.5">
            {list.slice(0, 6).map((reminder) => {
              const tone = toTone(reminder.tone);
              return (
                <li key={reminder.id} className="flex items-center gap-2 text-sm" style={toneStyle(tone)}>
                  <span className="tone-dot h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden />
                  <span className="flex-1 truncate">{reminder.title}</span>
                  {reminder.next_occurrence !== null && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {data.remindersToday.length === 0
                        ? new Intl.DateTimeFormat(i18n.language, {
                            weekday: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(reminder.next_occurrence)
                        : formatTime(reminder.next_occurrence, i18n.language)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </WidgetFrame>
  );
}

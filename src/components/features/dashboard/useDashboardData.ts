import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { calendarService, pomodoroService, reminderService, sessionService } from "@/services/tauri";
import { useChecklistStore } from "@/stores/checklistStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { CalendarDay, PomodoroState, Reminder, SessionSummary } from "@/types";

const DAY_MS = 86_400_000;
const UPCOMING_DAYS = 7;

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function monthBounds(ms: number): { from: number; to: number } {
  const d = new Date(ms);
  const from = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() - 1;
  return { from, to };
}

export interface DashboardData {
  todayStart: number;
  sessionsToday: SessionSummary[];
  sessionsWeekCount: number;
  focusTodayMs: number;
  reminders: Reminder[];
  remindersToday: Reminder[];
  remindersUpcoming: Reminder[];
  pomodoro: PomodoroState | null;
  monthDays: CalendarDay[];
}

/** Read-only aggregates for the overview Dashboard; refreshes on backend change events. */
export function useDashboardData(): DashboardData {
  const [now] = useState(() => Date.now());
  const todayStart = startOfDay(now);
  const todayEnd = todayStart + DAY_MS - 1;
  const [sessionsToday, setSessionsToday] = useState<SessionSummary[]>([]);
  const [sessionsWeekCount, setSessionsWeekCount] = useState(0);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [pomodoro, setPomodoro] = useState<PomodoroState | null>(null);
  const [monthDays, setMonthDays] = useState<CalendarDay[]>([]);
  // Starting/stopping a session changes today's session list.
  const activeSessionId = useSessionStore((s) => s.activeSession?.id ?? null);

  const refresh = useCallback(async () => {
    const { from, to } = monthBounds(now);
    const results = await Promise.allSettled([
      sessionService.listByRange(todayStart, todayEnd),
      sessionService.listByRange(todayStart - 6 * DAY_MS, todayEnd),
      reminderService.list(),
      pomodoroService.getState(),
      calendarService.getRange(from, to),
    ]);
    const [today, week, rem, pomo, cal] = results;
    if (today.status === "fulfilled") setSessionsToday(today.value);
    if (week.status === "fulfilled") setSessionsWeekCount(week.value.length);
    if (rem.status === "fulfilled") setReminders(rem.value);
    if (pomo.status === "fulfilled") setPomodoro(pomo.value);
    if (cal.status === "fulfilled") setMonthDays(cal.value.days);
  }, [now, todayStart, todayEnd]);

  useEffect(() => {
    void refresh();
  }, [refresh, activeSessionId]);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    for (const event of ["reminders:changed", "pomodoro:changed", "habits:changed"]) {
      void listen(event, () => void refresh())
        .then((fn) => unlisteners.push(fn))
        .catch(() => {});
    }
    return () => unlisteners.forEach((fn) => fn());
  }, [refresh]);

  const { remindersToday, remindersUpcoming } = useMemo(() => {
    const upcomingEnd = todayEnd + UPCOMING_DAYS * DAY_MS;
    const active = reminders
      .filter((r) => r.active && r.next_occurrence !== null)
      .sort((a, b) => (a.next_occurrence ?? 0) - (b.next_occurrence ?? 0));
    return {
      remindersToday: active.filter((r) => (r.next_occurrence ?? 0) <= todayEnd),
      remindersUpcoming: active.filter((r) => {
        const at = r.next_occurrence ?? 0;
        return at > todayEnd && at <= upcomingEnd;
      }),
    };
  }, [reminders, todayEnd]);

  const focusTodayMs = sessionsToday.reduce((sum, s) => sum + s.total_focus_ms, 0);

  return {
    todayStart,
    sessionsToday,
    sessionsWeekCount,
    focusTodayMs,
    reminders,
    remindersToday,
    remindersUpcoming,
    pomodoro,
    monthDays,
  };
}

/** Open checklist items split into due today (incl. overdue) and upcoming. */
export function useChecklistBuckets(todayStart: number) {
  const openItems = useChecklistStore((s) => s.openItems);
  return useMemo(() => {
    const todayEnd = todayStart + DAY_MS - 1;
    const open = openItems.filter((item) => item.completed_at === null);
    const dated = open
      .filter((item) => item.due_date !== null)
      .sort((a, b) => (a.due_date ?? 0) - (b.due_date ?? 0));
    return {
      open,
      today: dated.filter((item) => (item.due_date ?? 0) <= todayEnd),
      upcoming: dated.filter((item) => (item.due_date ?? 0) > todayEnd),
    };
  }, [openItems, todayStart]);
}

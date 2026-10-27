import type { ScheduleRule } from "@/types";

const WEEKDAY_ORDER = (weekStart: 0 | 1) =>
  weekStart === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];

export function emptyRule(kind: ScheduleRule["kind"]): ScheduleRule {
  switch (kind) {
    case "once":
      return { kind: "once", at: "" };
    case "daily":
      return { kind: "daily", times: ["09:00"], weekdays: [] };
    case "interval":
      return {
        kind: "interval",
        every_minutes: 60,
        window_start: "09:00",
        window_end: "18:00",
        weekdays: [1, 2, 3, 4, 5],
      };
    case "monthly":
      return { kind: "monthly", days: [1], times: ["09:00"] };
  }
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Locale-formatted `YYYY-MM-DDTHH:MM`; falls back to the raw value when unparsable. */
function formatOnceAt(at: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(at);
  if (!match) return at;
  const [, y, mo, d, h, mi] = match.map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  try {
    return new Intl.DateTimeFormat(locale || undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  } catch {
    return at;
  }
}

export function describeSchedule(
  rule: ScheduleRule,
  t: Translate,
  locale: string,
  weekStart: 0 | 1 = 1,
): string {
  const formatWeekdays = (days: number[]) => {
    if (days.length === 0) {
      return t("schedule.weekdays.every_day");
    }
    const sorted = [...days].sort(
      (a, b) => WEEKDAY_ORDER(weekStart).indexOf(a) - WEEKDAY_ORDER(weekStart).indexOf(b),
    );
    return sorted.map((d) => t(`schedule.weekdays.short.${d}`)).join(", ");
  };

  switch (rule.kind) {
    case "once":
      return t("schedule.summary.once", { at: formatOnceAt(rule.at, locale) || t("schedule.summary.unset") });
    case "daily":
      return t("schedule.summary.daily", {
        times: rule.times.join(", "),
        days: formatWeekdays(rule.weekdays),
      });
    case "interval":
      return t("schedule.summary.interval", {
        minutes: rule.every_minutes,
        start: rule.window_start,
        end: rule.window_end,
        days: formatWeekdays(rule.weekdays),
      });
    case "monthly":
      return t("schedule.summary.monthly", {
        days: rule.days.join(", "),
        times: rule.times.join(", "),
      });
  }
}

export function formatRelativeNext(
  ms: number | null | undefined,
  t: Translate,
  locale: string,
): string {
  if (ms == null) {
    return t("list.no_next");
  }
  const delta = ms - Date.now();
  if (delta < 60_000) {
    return t("list.next_soon");
  }
  const minutes = Math.round(delta / 60_000);
  if (minutes < 24 * 60) {
    return t("list.next_in_minutes", { count: minutes });
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

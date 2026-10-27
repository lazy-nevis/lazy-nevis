import type { TFunction } from "i18next";
import type { Habit, HabitProgress, HabitTargetProgress } from "@/types";

export function periodLabel(period: string, t: TFunction<"habits">): string {
  switch (period) {
    case "weekly":
      return t("period_weekly");
    case "monthly":
      return t("period_monthly");
    default:
      return t("period_daily");
  }
}

export function formatProgressLine(targets: HabitTargetProgress[]): string {
  return targets
    .map((t) => {
      const value = t.metric === "check"
        ? `${Math.round(t.progress)} / ${Math.round(t.target_value)}`
        : `${trimNumber(t.progress)} / ${trimNumber(t.target_value)} ${t.unit}`;
      return value;
    })
    .join(" · ");
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function isCheckOnly(habit: Habit): boolean {
  const active = habit.targets.filter((t) => t.archived_at == null);
  return active.length === 1 && active[0].metric === "check";
}

export function progressSummary(progress: HabitProgress): string {
  return formatProgressLine(progress.per_target);
}

export function metricLabel(metric: string, t: TFunction<"habits">): string {
  const key = `metrics.${metric}` as const;
  return t(key, { defaultValue: metric });
}

export function validateTargetCount(count: number): boolean {
  return count >= 1 && count <= 5;
}

export function isLogTimestampAllowed(loggedAtMs: number, nowMs: number): boolean {
  return Number.isFinite(loggedAtMs) && loggedAtMs > 0 && loggedAtMs <= nowMs;
}

export function defaultUnitForMetric(metric: string, t: TFunction<"habits">): string {
  switch (metric) {
    case "check":
      return "";
    case "count":
      return t("units.times");
    case "volume":
      return t("units.ml");
    case "mass":
      return t("units.g");
    case "distance":
      return t("units.m");
    case "duration":
      return t("units.min");
    default:
      return "";
  }
}

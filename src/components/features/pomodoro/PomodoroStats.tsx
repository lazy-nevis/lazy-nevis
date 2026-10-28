import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { AnimatedNumber } from "@/components/ui/motion";
import { StatCard } from "@/components/ui/stat-card";
import {
  buildDayBars,
  formatHourRange,
  localDayStartMs,
  type StatsMetric,
} from "@/components/features/pomodoro/pomodoroFormat";
import { pomodoroService } from "@/services/tauri";
import type { PomodoroStats as PomodoroStatsType } from "@/types";
import { cn } from "@/utils/cn";

type RangeDays = "7" | "30" | "90";

const DAY_MS = 86_400_000;

function useStats(from: number, to: number) {
  const [stats, setStats] = useState<PomodoroStatsType | null>(null);
  useEffect(() => {
    let cancelled = false;
    void pomodoroService.stats(from, to).then((next) => {
      if (!cancelled) setStats(next);
    });
    return () => {
      cancelled = true;
    };
  }, [from, to]);
  return stats;
}

export function PomodoroStats({
  refreshKey,
  dailyGoal,
}: {
  /** Changes whenever a phase ends or a run changes, so the report refetches. */
  refreshKey: string;
  dailyGoal: number;
}) {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: "pomodoro.stats" });
  const [range, setRange] = useState<RangeDays>("7");
  const [metric, setMetric] = useState<StatsMetric>("phases");

  // Re-anchored on every refresh so "today" rolls over at local midnight.
  const [to, setTo] = useState(() => Date.now());
  useEffect(() => {
    setTo(Date.now());
  }, [refreshKey, range]);
  const todayFrom = localDayStartMs(to);
  // Midday of the first day, floored, keeps the window DST-safe.
  const rangeFrom = localDayStartMs(todayFrom - (Number(range) - 1) * DAY_MS + DAY_MS / 2);

  const today = useStats(todayFrom, to);
  const report = useStats(rangeFrom, to);

  const numberFormat = useMemo(
    () => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }),
    [i18n.language],
  );
  const percentFormat = useMemo(
    () => new Intl.NumberFormat(i18n.language, { style: "percent", maximumFractionDigits: 0 }),
    [i18n.language],
  );
  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { day: "2-digit", month: "2-digit" }),
    [i18n.language],
  );

  const bars = useMemo(
    () => buildDayBars(report?.per_day ?? [], metric),
    [report?.per_day, metric],
  );
  const labelEvery = bars.length > 31 ? 14 : bars.length > 7 ? 5 : 1;

  return (
    <>
      <SectionCard title={t("today_title")}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t("focus_phases")}
            value={
              <>
                <AnimatedNumber value={today?.focus_phases_completed ?? 0} /> / {dailyGoal}
              </>
            }
          />
          <StatCard
            label={t("focus_minutes")}
            value={<AnimatedNumber value={Math.round((today?.focus_ms ?? 0) / 60_000)} />}
          />
          <StatCard label={t("breaks")} value={<AnimatedNumber value={today?.breaks_taken ?? 0} />} />
          <StatCard
            label={t("interruptions")}
            value={String(today?.interruptions ?? 0)}
            hint={t("interruptions_hint", {
              pauses: today?.pauses ?? 0,
              skips: today?.skips ?? 0,
              cancels: today?.cancels ?? 0,
            })}
          />
        </div>
      </SectionCard>

      <SectionCard
        title={t("report_title")}
        actions={
          <SegmentedControl<RangeDays>
            aria-label={t("range_label")}
            value={range}
            onChange={setRange}
            options={[
              { value: "7", label: t("range_7") },
              { value: "30", label: t("range_30") },
              { value: "90", label: t("range_90") },
            ]}
          />
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label={t("completion_rate")}
            value={percentFormat.format(report?.completion_rate ?? 0)}
            hint={t("completion_hint", {
              completed: report?.focus_phases_completed ?? 0,
              started: report?.focus_phases_started ?? 0,
            })}
          />
          <StatCard
            label={t("avg_pauses")}
            value={numberFormat.format(report?.avg_pauses_per_focus ?? 0)}
          />
          <StatCard
            label={t("best_hour")}
            value={
              report?.best_hour == null ? t("no_data") : formatHourRange(report.best_hour)
            }
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("chart_title")}
          </h3>
          <SegmentedControl<StatsMetric>
            aria-label={t("metric_label")}
            value={metric}
            onChange={setMetric}
            options={[
              { value: "phases", label: t("focus_phases") },
              { value: "minutes", label: t("focus_minutes") },
            ]}
          />
        </div>

        <ol
          className="mt-3 flex h-32 items-end gap-px"
          aria-label={t("chart_title")}
        >
          {bars.map((bar) => {
            const label = t("bar_title", {
              date: dayFormat.format(bar.date),
              phases: bar.phases,
              minutes: bar.minutes,
            });
            return (
              <li
                key={bar.day}
                className="flex h-full min-w-0 flex-1 flex-col justify-end"
                title={label}
                aria-label={label}
              >
                <div
                  className={cn(
                    "w-full rounded-t-sm motion-safe:transition-[height]",
                    bar.value > 0 ? "bg-brand" : "bg-muted",
                  )}
                  style={{ height: `${Math.max(bar.ratio * 100, 2)}%` }}
                />
              </li>
            );
          })}
        </ol>
        <div className="mt-1 flex gap-px text-[10px] text-muted-foreground" aria-hidden>
          {bars.map((bar, index) => (
            <span key={bar.day} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
              {index % labelEvery === 0 ? dayFormat.format(bar.date) : ""}
            </span>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

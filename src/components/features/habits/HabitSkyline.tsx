import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ContributionSkyline,
  type ContributionDay,
  type ContributionSkylineLabels,
} from "@/components/ui/contribution-skyline";
import type { HabitDayPoint, HabitLog } from "@/types";
import { toneColor, toTone } from "@/utils/tones";
import { HabitDayPopover } from "@/components/features/habits/HabitDayPopover";

export function HabitSkyline({
  points,
  weekStart,
  unit,
  tone = "emerald",
  habitId,
  logs,
  onDayClick,
  onEditLog,
}: {
  points: HabitDayPoint[];
  weekStart: 0 | 1;
  unit: string;
  tone?: string;
  habitId?: string;
  logs?: HabitLog[];
  onDayClick?: (date: string) => void;
  onEditLog?: (log: HabitLog) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [popoverDate, setPopoverDate] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const palette = useMemo(() => {
    const name = toTone(tone);
    return [
      toneColor(name, 0.15),
      toneColor(name, 0.35),
      toneColor(name, 0.55),
      toneColor(name, 0.85),
    ];
  }, [tone]);

  const data: ContributionDay[] = useMemo(
    () => points.map((p) => ({ date: p.date, count: p.value })),
    [points],
  );

  const labels: ContributionSkylineLabels = useMemo(
    () => ({
      noData: t("skyline_no_data"),
      chartViewAria: t("skyline_chart_view_aria"),
      viewFlatAria: t("skyline_2d"),
      view3dAria: t("skyline_3d"),
      hintHeatmap: t("skyline_hint_heatmap"),
      hintOrbit: t("skyline_hint_orbit"),
      less: t("skyline_less"),
      more: t("skyline_more"),
      statYearTotal: t("skyline_stat_year"),
      statBusiestDay: t("skyline_stat_busiest"),
      statLongestStreak: t("skyline_stat_longest"),
      statCurrentStreak: t("skyline_stat_current"),
      day: t("skyline_day"),
      days: t("skyline_days"),
      levelNo: t("skyline_level_no", { unit }),
      levelLight: t("skyline_level_light"),
      levelModerate: t("skyline_level_moderate"),
      levelHeavy: t("skyline_level_heavy"),
      levelHeaviest: t("skyline_level_heaviest"),
      highlightLevel: (name) => t("skyline_highlight_level", { level: name }),
      formatCellAnnounce: (count, unitLabel, dateLabel) =>
        t("skyline_tooltip", { value: count, unit: unitLabel, date: dateLabel }),
      formatCellTooltip: (count, unitLabel, dateLabel) =>
        t("skyline_tooltip", { value: count, unit: unitLabel, date: dateLabel }),
      formatAriaChart: (total, unitLabel, range, is3d) =>
        t("skyline_aria_chart", { total, unit: unitLabel, range, mode: is3d ? "3d" : "2d" }),
      formatTitle: (total, unitLabel) =>
        t("skyline_title", { total, unit: unitLabel }),
    }),
    [t, unit],
  );

  const dayLogs = useMemo(() => {
    if (!popoverDate || !logs) return [];
    const start = new Date(`${popoverDate}T00:00:00`).getTime();
    const end = start + 86_400_000;
    return logs.filter((log) => log.logged_at >= start && log.logged_at < end);
  }, [logs, popoverDate]);

  return (
    <div className="relative">
      <ContributionSkyline
        data={data}
        palette={palette}
        weekStart={weekStart}
        unit={unit}
        labels={labels}
        reducedMotion={reducedMotion}
        showStats={Boolean(habitId)}
        defaultView="2d"
        onCellClick={(day) => {
          if (habitId && logs) {
            setPopoverDate(day.date);
          }
          onDayClick?.(day.date);
        }}
      />
      {popoverDate && habitId && logs && (
        <HabitDayPopover
          date={popoverDate}
          logs={dayLogs}
          onClose={() => setPopoverDate(null)}
          onEditLog={(log) => {
            setPopoverDate(null);
            onEditLog?.(log);
          }}
        />
      )}
    </div>
  );
}

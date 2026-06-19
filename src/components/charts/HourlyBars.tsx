import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatDurationHuman } from "@/utils/formatters";
import type { TimelineEvent } from "@/types";

interface Props {
  events: TimelineEvent[];
  sessionStart: number;
  sessionEnd: number;
  title?: string;
}

export function HourlyBars({ events, sessionStart, sessionEnd, title }: Props) {
  const { t } = useTranslation();
  const buckets = useMemo(() => {
    const startDate = new Date(sessionStart);
    const endDate   = new Date(sessionEnd);
    const startHour = startDate.getHours();
    const endHour   = endDate.getHours();

    // Initialize buckets for every hour of the session
    const map: Record<number, { focus: number; distracted: number }> = {};
    for (let h = startHour; h <= endHour; h++) {
      map[h] = { focus: 0, distracted: 0 };
    }

    for (const ev of events) {
      if (!["app_focus", "title_change"].includes(ev.event_type)) continue;

      const evStart = ev.started_at;
      // Use ended_at if available, otherwise estimate from duration_ms, otherwise skip
      const evEnd = ev.ended_at
        ?? (ev.duration_ms != null && ev.duration_ms > 0 ? ev.started_at + ev.duration_ms : null);
      if (!evEnd || evEnd <= evStart) continue;

      const span = evEnd - evStart;
      if (span <= 0) continue;

      for (let h = startHour; h <= endHour; h++) {
        if (!map[h]) continue;

        // Build hour boundaries relative to the session date
        const base = new Date(sessionStart);
        base.setHours(h, 0, 0, 0);
        const hourStart = base.getTime();
        const hourEnd   = hourStart + 3_600_000;

        const overlap = Math.max(0, Math.min(evEnd, hourEnd) - Math.max(evStart, hourStart));
        if (overlap <= 0) continue;

        // Proportion of the event that falls in this hour
        const fraction = overlap / span;
        const ms = fraction * (ev.duration_ms ?? span);

        if (ev.is_distraction) {
          map[h].distracted += ms;
        } else {
          map[h].focus += ms;
        }
      }
    }

    return Object.entries(map)
      .map(([h, v]) => ({ hour: Number(h), ...v }))
      .sort((a, b) => a.hour - b.hour);
  }, [events, sessionStart, sessionEnd]);

  const maxMs = Math.max(...buckets.map((b) => b.focus + b.distracted), 1);
  const barH = 96;
  const barW = Math.min(52, Math.max(24, Math.floor(480 / Math.max(buckets.length, 1))));
  const gap  = 3;
  const chartW = buckets.length * (barW + gap);

  if (buckets.length === 0 || maxMs <= 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        {t("dashboard.charts.no_hourly_data")}
      </div>
    );
  }

  return (
    <div className="w-full">
      {title && (
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
      )}
      <div className="overflow-x-auto">
        <svg width={chartW} height={barH + 22} className="overflow-visible">
          {buckets.map((b, i) => {
            const x = i * (barW + gap);
            const total = b.focus + b.distracted;
            const focusPx    = (b.focus / maxMs) * barH;
            const distractPx = (b.distracted / maxMs) * barH;

            return (
              <g key={b.hour}>
                {/* Background track */}
                <rect x={x} y={0} width={barW} height={barH}
                  fill="currentColor" className="text-muted/10" rx={2} />
                {/* Distraction (bottom) */}
                {b.distracted > 0 && (
                  <rect x={x} y={barH - distractPx} width={barW} height={distractPx}
                    fill="#ef4444" rx={2} opacity={0.85} />
                )}
                {/* Focus (above distraction) */}
                {b.focus > 0 && (
                  <rect x={x} y={barH - distractPx - focusPx} width={barW} height={focusPx}
                    fill="#22c55e" rx={2} opacity={0.85} />
                )}
                {/* Hour label */}
                <text x={x + barW / 2} y={barH + 14} textAnchor="middle"
                  fontSize={9} fill="currentColor" className="fill-muted-foreground">
                  {b.hour}h
                </text>
                {/* Tooltip */}
                {total > 0 && (
                  <title>
                    {`${b.hour}:00–${b.hour + 1}:00
Focus: ${formatDurationHuman(b.focus)}
Distracted: ${formatDurationHuman(b.distracted)}`}
                  </title>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {/* Legend */}
      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-green-500" />{t("dashboard.charts.focus")}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-500" />{t("dashboard.charts.distracted")}</span>
      </div>
    </div>
  );
}

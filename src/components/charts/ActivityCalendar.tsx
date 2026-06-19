import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/formatters";
import type { SessionSummary } from "@/types";

interface Props {
  sessions: SessionSummary[];
  locale: string;
  weeks?: number; // number of weeks to display (default 12)
  title?: string;
}

export function ActivityCalendar({ sessions, locale, weeks = 16, title }: Props) {
  const { t } = useTranslation();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Build map: "YYYY-MM-DD" → { sessions: n, bestFocus: pct }
  const dayMap = useMemo(() => {
    const map: Record<string, { sessions: number; bestFocus: number; totalMs: number }> = {};
    for (const s of sessions) {
      const d = new Date(s.started_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!map[key]) map[key] = { sessions: 0, bestFocus: 0, totalMs: 0 };
      map[key].sessions++;
      map[key].bestFocus = Math.max(map[key].bestFocus, s.focus_percent);
      map[key].totalMs += s.total_focus_ms + s.total_distracted_ms + s.total_idle_ms;
    }
    return map;
  }, [sessions]);

  // Build grid: columns = weeks, rows = 7 (Sun→Sat)
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (weeks * 7 - 1));
  // Align to start of week (Sunday)
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const grid: Date[][] = [];
  const cur = new Date(startDate);
  for (let w = 0; w < weeks; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    grid.push(week);
  }

  function cellColor(day: Date): string {
    if (day > today) return "";
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const entry = dayMap[key];
    if (!entry) return "bg-muted/30";
    const pct = entry.bestFocus;
    if (pct >= 80) return "bg-green-500";
    if (pct >= 60) return "bg-green-400";
    if (pct >= 40) return "bg-green-300";
    if (pct >= 20) return "bg-green-200 dark:bg-green-700";
    return "bg-green-100 dark:bg-green-900";
  }

  const cellSize = 12;
  const gap = 3;
  const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="w-full">
      {title && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>}
      <div className="overflow-x-auto">
        <div className="flex gap-1">
          {/* Day-of-week labels */}
          <div className="flex flex-col gap-0.5 mr-1 mt-5">
            {[1, 3, 5].map((d) => (
              <div key={d} style={{ height: cellSize, marginBottom: gap - 1 }} className="text-[8px] text-muted-foreground leading-none flex items-center">
                {DAYS[d]}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex gap-0.5">
            {grid.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {/* Month label on first day of month */}
                <div className="h-5 flex items-end">
                  {week[0].getDate() <= 7 && (
                    <span className="text-[8px] text-muted-foreground leading-none">
                      {week[0].toLocaleString(locale, { month: "short" })}
                    </span>
                  )}
                </div>
                {week.map((day, di) => {
                  const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                  const entry = dayMap[key];
                  const isToday = day.toDateString() === today.toDateString();
                  const isFuture = day > today;

                  return (
                    <div
                      key={di}
                      className={cn(
                        "rounded-sm transition-all",
                        isFuture ? "bg-transparent" : cellColor(day),
                        isToday && "ring-1 ring-primary ring-offset-1"
                      )}
                      style={{ width: cellSize, height: cellSize }}
                      title={
                        entry
                          ? `${formatDate(day.getTime(), locale)}: ${entry.sessions} session(s), ${Math.round(entry.bestFocus)}% best focus`
                          : isFuture ? "" : `${formatDate(day.getTime(), locale)}: no sessions`
                      }
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
        <span>{t("dashboard.charts.less")}</span>
        {["bg-muted/30", "bg-green-100 dark:bg-green-900", "bg-green-300", "bg-green-400", "bg-green-500"].map((c) => (
          <div key={c} className={cn("h-2.5 w-2.5 rounded-sm", c)} />
        ))}
        <span>{t("dashboard.charts.more")}</span>
      </div>
    </div>
  );
}

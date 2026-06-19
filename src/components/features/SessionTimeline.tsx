import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/cn";
import { formatTime, formatDurationHuman } from "@/utils/formatters";
import type { Checkpoint, TimelineEvent } from "@/types";

interface Props {
  events: TimelineEvent[];
  checkpoints: Checkpoint[];
  sessionStart: number;
  sessionEnd: number;
  onFlipClassification?: (eventId: string, newIsDistraction: boolean) => void;
  locale: string;
}

// Deterministic color per app name (focus palette: blue/green tones)
function appColor(appName: string, isDistraction: boolean): string {
  if (isDistraction) return "#ef4444"; // red-500
  const hash = Array.from(appName).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const hues = [155, 175, 200, 220, 245, 270];
  return `hsl(${hues[hash % hues.length]}, 52%, 42%)`;
}

export function SessionTimeline({ events, checkpoints, sessionStart, sessionEnd, locale, onFlipClassification }: Props) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<TimelineEvent | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const totalMs = Math.max(sessionEnd - sessionStart, 1);

  // Only show app_focus and title_change events in the visual bar
  const displayEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          (e.event_type === "app_focus" || e.event_type === "title_change") &&
          e.app_name
      ),
    [events]
  );

  return (
    <div className="w-full select-none">
      {/* ── Visual timeline bar ──────────────────────────────────────── */}
      <div className="relative h-10 rounded-lg overflow-hidden bg-muted/40 border mb-2">
        {/* Color blocks */}
        {displayEvents.map((ev) => {
          const start = ev.started_at - sessionStart;
          const end = ev.ended_at ? ev.ended_at - sessionStart : totalMs;
          const leftPct = (start / totalMs) * 100;
          const widthPct = Math.max(((end - start) / totalMs) * 100, 0.15);
          const color = appColor(ev.app_name ?? "", ev.is_distraction);

          return (
            <div
              key={ev.id}
              className="absolute inset-y-0 cursor-pointer"
              style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: color }}
              onMouseEnter={(e) => {
                setHovered(ev);
                setTooltipPos({ x: e.clientX, y: e.clientY });
              }}
              onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}

        {/* Amber vertical tick at the START of every event (including title_change) */}
        {displayEvents.map((ev) => {
          const leftPct = ((ev.started_at - sessionStart) / totalMs) * 100;
          return (
            <div
              key={`tick-${ev.id}`}
              className="absolute inset-y-0 w-px bg-amber-400/70 z-10 pointer-events-none"
              style={{ left: `${leftPct}%` }}
            />
          );
        })}

        {/* Bright yellow checkpoint markers */}
        {checkpoints.map((cp) => {
          const pct = ((cp.created_at - sessionStart) / totalMs) * 100;
          return (
            <div
              key={cp.id}
              className="absolute inset-y-0 w-0.5 bg-yellow-400 z-20 pointer-events-none"
              style={{ left: `${pct}%` }}
              title={cp.label ?? "Checkpoint"}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-500 opacity-80" /> {t("dashboard.charts.focus")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> {t("dashboard.charts.distracted")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-0.5 h-3 bg-amber-400/70" /> {t("history.detail.app_switch")}
        </span>
        {checkpoints.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-0.5 h-3 bg-yellow-400" /> {t("dashboard.checkpoints.title")}
          </span>
        )}
        <span className="ml-auto">
          {formatTime(sessionStart, locale)}
          {" → "}
          {sessionEnd > sessionStart ? formatTime(sessionEnd, locale) : "now"}
        </span>
      </div>

      {/* ── Written event list ──────────────────────────────────────── */}
      <div className="space-y-0.5 max-h-60 overflow-y-auto rounded-md">
        {displayEvents.map((ev) => {
          const isTitleChange = ev.event_type === "title_change";
          const tabTitle = isTitleChange && ev.window_title && ev.window_title !== ev.app_name
            ? ev.window_title
            : null;

          return (
            <div
              key={ev.id}
              className={cn(
                "flex items-start gap-3 text-xs py-1.5 px-2 rounded hover:bg-accent/40 transition-colors",
                ev.is_distraction ? "text-red-600 dark:text-red-400" : "text-foreground"
              )}
            >
              {/* Color dot */}
              <span
                className="h-2 w-2 rounded-full shrink-0 mt-0.5"
                style={{ backgroundColor: appColor(ev.app_name ?? "", ev.is_distraction) }}
              />

              {/* Time */}
              <span className="font-mono text-muted-foreground tabular-nums shrink-0 w-14">
                {formatTime(ev.started_at, locale)}
              </span>

              {/* App + tab info */}
              <div className="flex-1 min-w-0">
                <span className="font-medium">{ev.app_name}</span>
                {isTitleChange && (
                  <span className="text-muted-foreground text-[10px] ml-1 uppercase tracking-wide">
                    (tab)
                  </span>
                )}
                {tabTitle && (
                  <p className="text-muted-foreground truncate mt-0.5 text-[11px]">
                    ↳ {tabTitle}
                  </p>
                )}
              </div>

              {/* Duration */}
              {ev.duration_ms != null && ev.duration_ms > 0 && (
                <span className="text-muted-foreground shrink-0 whitespace-nowrap">
                  {formatDurationHuman(ev.duration_ms)}
                </span>
              )}

              {/* Flip focus/distraction button */}
              {onFlipClassification && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFlipClassification(ev.id, !ev.is_distraction);
                  }}
                  title={ev.is_distraction ? "Mark as focus" : "Mark as distraction"}
                  className={cn(
                    "ml-1 shrink-0 h-5 w-5 rounded flex items-center justify-center text-[10px] border transition-colors",
                    ev.is_distraction
                      ? "border-red-300 text-red-500 hover:bg-green-50 hover:border-green-400 hover:text-green-600 dark:hover:bg-green-950"
                      : "border-green-300 text-green-600 hover:bg-red-50 hover:border-red-400 hover:text-red-500 dark:hover:bg-red-950"
                  )}
                >
                  {ev.is_distraction ? "→F" : "→D"}
                </button>
              )}
            </div>
          );
        })}

        {displayEvents.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">{t("history.detail.no_events")}</p>
        )}
      </div>

      {/* Floating tooltip on bar hover */}
      {hovered && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-2.5 text-xs max-w-xs"
          style={{ left: tooltipPos.x + 14, top: tooltipPos.y - 48 }}
        >
          <p className="font-semibold">{hovered.app_name}</p>
          {hovered.window_title && hovered.window_title !== hovered.app_name && (
            <p className="text-muted-foreground truncate mt-0.5">{hovered.window_title}</p>
          )}
          <p className="mt-1 text-muted-foreground">
            {formatTime(hovered.started_at, locale)}
            {hovered.ended_at ? ` → ${formatTime(hovered.ended_at, locale)}` : ""}
            {hovered.duration_ms && hovered.duration_ms > 0
              ? ` (${formatDurationHuman(hovered.duration_ms)})` : ""}
          </p>
          <p className={cn("mt-0.5 font-medium", hovered.is_distraction ? "text-red-500" : "text-emerald-500")}>
            {hovered.is_distraction ? "Distraction" : "Focus"}
          </p>
        </div>
      )}
    </div>
  );
}

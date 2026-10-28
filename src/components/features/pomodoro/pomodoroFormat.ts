import type { PomodoroDayStat, PomodoroPhaseKind } from "@/types";
import type { Tone } from "@/utils/tones";

export type StatsMetric = "phases" | "minutes";

export interface DayBar {
  day: string;
  date: Date;
  phases: number;
  minutes: number;
  value: number;
  /** 0–1 relative to the busiest day in the series. */
  ratio: number;
}

/** Local midnight of the day containing `ms`. */
export function localDayStartMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Parses a backend `YYYY-MM-DD` local day key into a local Date. */
export function parseDayKey(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function buildDayBars(perDay: PomodoroDayStat[], metric: StatsMetric): DayBar[] {
  const rows = perDay.map((d) => {
    const minutes = Math.round(d.focus_ms / 60_000);
    return {
      day: d.day,
      date: parseDayKey(d.day),
      phases: d.focus_phases,
      minutes,
      value: metric === "phases" ? d.focus_phases : minutes,
    };
  });
  const max = rows.reduce((acc, r) => Math.max(acc, r.value), 0);
  return rows.map((r) => ({ ...r, ratio: max > 0 ? r.value / max : 0 }));
}

/** `9` → `09:00–10:00` */
export function formatHourRange(hour: number): string {
  const pad = (n: number) => String(n % 24).padStart(2, "0");
  return `${pad(hour)}:00–${pad(hour + 1)}:00`;
}

export function formatPomodoroClock(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function phaseProgress(elapsedMs: number, plannedMs: number): number {
  if (plannedMs <= 0) return 0;
  return Math.min(1, Math.max(0, elapsedMs / plannedMs));
}

export function phaseRingStrokeClass(kind: PomodoroPhaseKind | null): string {
  if (kind === "focus") return "stroke-brand";
  if (kind === "short_break" || kind === "long_break") return "stroke-success";
  return "stroke-muted-foreground/30";
}

export function phaseGlowTone(kind: PomodoroPhaseKind | null): Tone {
  if (kind === "focus") return "orange";
  if (kind === "short_break" || kind === "long_break") return "emerald";
  return "slate";
}

export function phaseIndicatorClass(kind: PomodoroPhaseKind | null): string {
  if (kind === "focus") return "bg-brand motion-safe:animate-pulse";
  if (kind === "short_break" || kind === "long_break") return "bg-success";
  return "bg-muted-foreground/50";
}

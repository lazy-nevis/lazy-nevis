import { describe, expect, it } from "vitest";
import {
  buildDayBars,
  formatHourRange,
  formatPomodoroClock,
  localDayStartMs,
  parseDayKey,
  phaseProgress,
} from "./pomodoroFormat";

describe("pomodoroFormat", () => {
  it("formats mm:ss", () => {
    expect(formatPomodoroClock(125_000)).toBe("02:05");
    expect(formatPomodoroClock(-1)).toBe("00:00");
  });

  it("computes phase progress", () => {
    expect(phaseProgress(30_000, 60_000)).toBe(0.5);
    expect(phaseProgress(90_000, 60_000)).toBe(1);
  });

  it("floors to local midnight", () => {
    const at = new Date(2026, 9, 26, 22, 30).getTime();
    expect(localDayStartMs(at)).toBe(new Date(2026, 9, 26).getTime());
  });

  it("parses day keys as local dates", () => {
    const d = parseDayKey("2026-10-24");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 24]);
  });

  it("builds bars relative to the busiest day for the chosen metric", () => {
    const perDay = [
      { day: "2026-10-24", focus_phases: 2, focus_ms: 3_000_000 },
      { day: "2026-10-25", focus_phases: 0, focus_ms: 0 },
      { day: "2026-10-26", focus_phases: 4, focus_ms: 1_500_000 },
    ];
    expect(buildDayBars(perDay, "phases").map((b) => b.ratio)).toEqual([0.5, 0, 1]);
    expect(buildDayBars(perDay, "minutes").map((b) => b.value)).toEqual([50, 0, 25]);
    expect(buildDayBars([], "phases")).toEqual([]);
  });

  it("formats hour ranges", () => {
    expect(formatHourRange(9)).toBe("09:00–10:00");
    expect(formatHourRange(23)).toBe("23:00–00:00");
  });
});

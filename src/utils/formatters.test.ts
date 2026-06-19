import { describe, it, expect } from "vitest";
import { formatDuration, formatDurationHuman, formatPercent, clamp } from "./formatters";

describe("formatDuration", () => {
  it("formats zero as 00:00:00", () => {
    expect(formatDuration(0)).toBe("00:00:00");
  });

  it("formats 90 seconds correctly", () => {
    expect(formatDuration(90_000)).toBe("00:01:30");
  });

  it("formats 2 hours correctly", () => {
    expect(formatDuration(7_200_000)).toBe("02:00:00");
  });
});

describe("formatDurationHuman", () => {
  it("returns seconds for short durations", () => {
    expect(formatDurationHuman(5_000)).toBe("5s");
  });

  it("returns minutes only", () => {
    expect(formatDurationHuman(300_000)).toBe("5m");
  });

  it("returns hours and minutes", () => {
    expect(formatDurationHuman(5_400_000)).toBe("1h 30m");
  });

  it("returns hours only when no minutes", () => {
    expect(formatDurationHuman(3_600_000)).toBe("1h");
  });

  it("uses the Portuguese minute abbreviation", () => {
    expect(formatDurationHuman(5_400_000, "pt-BR")).toBe("1h 30min");
  });
});

describe("formatPercent", () => {
  it("rounds to integer", () => {
    expect(formatPercent(87.6)).toBe("88%");
  });

  it("handles 0", () => {
    expect(formatPercent(0)).toBe("0%");
  });

  it("handles 100", () => {
    expect(formatPercent(100)).toBe("100%");
  });
});

describe("clamp", () => {
  it("clamps below min", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it("clamps above max", () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it("passes through values in range", () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });
});

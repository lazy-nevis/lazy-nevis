import { describe, expect, it } from "vitest";
import { rangeBounds } from "@/components/features/habits/HabitReports";
import { periodLabel } from "@/components/features/habits/habitFormat";

describe("HabitReports rangeBounds", () => {
  it("rolls year range to January 1 local", () => {
    const now = new Date("2024-06-15T12:00:00").getTime();
    const { from, to } = rangeBounds("year", now);
    expect(to).toBe(now);
    expect(new Date(from).getMonth()).toBe(0);
    expect(new Date(from).getDate()).toBe(1);
  });

  it("uses 7-day window for short range", () => {
    const now = 1_700_000_000_000;
    const { from } = rangeBounds("7", now);
    expect(now - from).toBe(7 * 86_400_000);
  });
});

describe("period labels", () => {
  it("maps weekly and monthly periods", () => {
    const t = ((key: string) => key) as Parameters<typeof periodLabel>[1];
    expect(periodLabel("weekly", t)).toBe("period_weekly");
    expect(periodLabel("monthly", t)).toBe("period_monthly");
  });
});

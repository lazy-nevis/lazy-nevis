import { describe, expect, it } from "vitest";
import {
  daysAgo,
  endOfLocalDay,
  fromDateInputValue,
  shiftDays,
  startOfLocalDay,
  toDateInputValue,
} from "./dates";

describe("dates", () => {
  it("bounds a local day", () => {
    const noon = new Date(2026, 6, 17, 12, 30).getTime();
    expect(new Date(startOfLocalDay(noon)).getHours()).toBe(0);
    expect(new Date(endOfLocalDay(noon)).getHours()).toBe(23);
  });

  it("computes whole days ago", () => {
    const now = new Date(2026, 6, 17, 9, 0).getTime();
    expect(daysAgo(now, now)).toBe(0);
    expect(daysAgo(new Date(2026, 6, 16, 23, 0).getTime(), now)).toBe(1);
    expect(daysAgo(new Date(2026, 6, 10, 1, 0).getTime(), now)).toBe(7);
  });

  it("shifts across month boundaries", () => {
    const lastOfMonth = new Date(2026, 6, 31, 10, 0).getTime();
    expect(new Date(shiftDays(lastOfMonth, 1)).getMonth()).toBe(7);
  });

  it("round-trips date input values", () => {
    const ms = new Date(2026, 0, 5).getTime();
    expect(toDateInputValue(ms)).toBe("2026-01-05");
    expect(fromDateInputValue("2026-01-05")).toBe(ms);
    expect(fromDateInputValue("")).toBeNull();
  });
});

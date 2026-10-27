import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNow, isTodayFilter } from "./useNow";
import { endOfLocalDay, startOfLocalDay } from "@/utils/dates";

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ticks on interval", () => {
    const { result } = renderHook(() => useNow(1000));
    const first = result.current;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBeGreaterThanOrEqual(first);
  });

  it("detects today filter", () => {
    const now = Date.now();
    expect(isTodayFilter(startOfLocalDay(now), endOfLocalDay(now), now)).toBe(true);
    expect(isTodayFilter(null, endOfLocalDay(now), now)).toBe(false);
  });
});

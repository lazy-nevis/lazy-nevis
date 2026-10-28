import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDashboardData } from "./useDashboardData";
import { usePomodoroStore } from "@/stores/pomodoroStore";
import { calendarService, reminderService, sessionService } from "@/services/tauri";
import type { PomodoroState } from "@/types";

const idle: PomodoroState = {
  run: null,
  phase: null,
  remaining_ms: 0,
  elapsed_ms: 0,
  state: "awaiting",
  focus_completed_in_set: 0,
  long_break_every: 4,
  today_completed: 0,
  daily_goal: 8,
};

beforeEach(() => {
  usePomodoroStore.setState({ state: idle, hydrated: true });
  vi.spyOn(sessionService, "listByRange").mockResolvedValue([]);
  vi.spyOn(reminderService, "list").mockResolvedValue([]);
  vi.spyOn(calendarService, "getRange").mockResolvedValue({ from_ms: 0, to_ms: 0, days: [], entries: [] });
});

describe("useDashboardData", () => {
  // Regression: the Dashboard kept its own snapshot refreshed only on
  // pomodoro:changed, so the countdown froze between phase changes.
  it("follows live Pomodoro store updates (pomodoro:tick)", async () => {
    const { result } = renderHook(() => useDashboardData());
    expect(result.current.pomodoro?.remaining_ms).toBe(0);

    act(() => {
      usePomodoroStore.getState().setState({ ...idle, remaining_ms: 1_499_000, today_completed: 2 });
    });
    expect(result.current.pomodoro?.remaining_ms).toBe(1_499_000);

    act(() => {
      usePomodoroStore.getState().setState({ ...idle, remaining_ms: 1_498_000, today_completed: 2 });
    });
    expect(result.current.pomodoro?.remaining_ms).toBe(1_498_000);
    expect(result.current.pomodoro?.today_completed).toBe(2);
  });
});

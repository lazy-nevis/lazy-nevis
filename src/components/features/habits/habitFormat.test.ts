import { describe, expect, it } from "vitest";
import {
  formatProgressLine,
  isCheckOnly,
  isLogTimestampAllowed,
  validateTargetCount,
} from "@/components/features/habits/habitFormat";
import type { Habit } from "@/types";

describe("habitFormat", () => {
  it("formats multi-target progress", () => {
    const line = formatProgressLine([
      {
        target_id: "a",
        metric: "volume",
        unit: "L",
        target_value: 2,
        progress: 1.2,
      },
    ]);
    expect(line).toContain("1.2 / 2 L");
  });

  it("detects check-only habits", () => {
    const habit: Habit = {
      id: "1",
      name: "Read",
      description: null,
      tone: "emerald",
      icon: "book",
      period: "daily",
      active: true,
      skip_reminders_when_met: true,
      channels: null,
      sound: null,
      sort_order: 0,
      created_at: 0,
      updated_at: 0,
      targets: [
        {
          id: "t1",
          habit_id: "1",
          metric: "check",
          unit: "",
          target_value: 1,
          sort_order: 0,
          archived_at: null,
        },
      ],
      schedules: [],
    };
    expect(isCheckOnly(habit)).toBe(true);
  });

  it("validates target count bounds", () => {
    expect(validateTargetCount(0)).toBe(false);
    expect(validateTargetCount(1)).toBe(true);
    expect(validateTargetCount(5)).toBe(true);
    expect(validateTargetCount(6)).toBe(false);
  });

  it("rejects future log timestamps", () => {
    const now = 1_700_000_000_000;
    expect(isLogTimestampAllowed(now - 1000, now)).toBe(true);
    expect(isLogTimestampAllowed(now + 1000, now)).toBe(false);
  });
});

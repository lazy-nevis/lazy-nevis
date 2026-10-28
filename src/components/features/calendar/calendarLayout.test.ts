import { describe, expect, it } from "vitest";
import {
  clipIntervalToDay,
  layoutTimedBlocks,
  msToDayRatio,
  splitTimedRangeAcrossDays,
  type TimedBlockInput,
} from "./calendarLayout";
import { parseDateKey } from "./calendarMath";

const DAY = "2026-10-15";

function atLocal(hour: number, minute = 0): number {
  const d = parseDateKey(DAY);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

describe("clipIntervalToDay", () => {
  it("clips interval that spans before and after the day", () => {
    const dayStart = atLocal(0);
    const clip = clipIntervalToDay(DAY, dayStart - 3_600_000, dayStart + 10 * 3_600_000);
    expect(clip).toEqual({ startMs: dayStart, endMs: atLocal(10) });
  });

  it("returns null when interval is entirely outside the day", () => {
    expect(clipIntervalToDay(DAY, atLocal(0) - 5_000, atLocal(0) - 1)).toBeNull();
  });
});

describe("splitTimedRangeAcrossDays", () => {
  it("splits a session crossing midnight into two day segments", () => {
    const start = atLocal(22);
    const end = atLocal(2) + 24 * 3_600_000;
    const parts = splitTimedRangeAcrossDays(start, end);
    expect(parts).toHaveLength(2);
    expect(parts[0].dateKey).toBe(DAY);
    expect(parts[1].dateKey).toBe("2026-10-16");
    expect(parts[0].startMs).toBe(start);
    expect(parts[1].endMs).toBe(end);
  });
});

describe("layoutTimedBlocks", () => {
  it("places overlapping blocks side by side", () => {
    const blocks: TimedBlockInput[] = [
      {
        id: "a",
        entryId: "a",
        kind: "session",
        startMs: atLocal(9),
        endMs: atLocal(11),
      },
      {
        id: "b",
        entryId: "b",
        kind: "session",
        startMs: atLocal(10),
        endMs: atLocal(12),
      },
    ];
    const laid = layoutTimedBlocks(DAY, blocks);
    expect(laid).toHaveLength(2);
    const cols = new Set(laid.map((b) => b.column));
    expect(cols.size).toBe(2);
    expect(laid[0].columnCount).toBe(2);
    expect(laid[1].columnCount).toBe(2);
  });

  it("clips blocks to day bounds before layout", () => {
    const dayStart = atLocal(0);
    const blocks: TimedBlockInput[] = [
      {
        id: "long",
        entryId: "long",
        kind: "session",
        startMs: dayStart - 3_600_000,
        endMs: atLocal(1),
      },
    ];
    const laid = layoutTimedBlocks(DAY, blocks);
    expect(laid).toHaveLength(1);
    expect(laid[0].startMs).toBe(dayStart);
    expect(laid[0].topRatio).toBe(0);
    expect(laid[0].heightRatio).toBeCloseTo(msToDayRatio(atLocal(1), DAY), 5);
  });
});

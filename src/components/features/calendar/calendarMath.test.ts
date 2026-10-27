import { describe, expect, it } from "vitest";
import type { CalendarEntry } from "@/types";
import {
  entryMatchesQuery,
  entryOnDate,
  groupEntriesByDate,
  monthGrid,
  weekDateKeys,
} from "./calendarMath";

describe("calendarMath", () => {
  it("builds a 6-week month grid with Monday week start", () => {
    const anchor = new Date(2026, 9, 15);
    const grid = monthGrid(anchor, 1);
    expect(grid).toHaveLength(42);
    expect(grid.some((d) => d.date === "2026-10-01" && d.inMonth)).toBe(true);
    expect(grid[0].date).toBe("2026-09-28");
  });

  it("week keys start on Sunday when week_start is 0", () => {
    const anchor = new Date(2026, 9, 15);
    const keys = weekDateKeys(anchor, 0);
    expect(keys).toHaveLength(7);
    expect(parseDateKey(keys[0]).getDay()).toBe(0);
  });
});

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(y, m - 1, d);
}

describe("entryMatchesQuery", () => {
  const entry = { kind: "reminder_occurrence", title: "Beber água" } as unknown as CalendarEntry;
  const label = () => "Lembretes";

  it("matches entries by title or kind label, ignoring case and accents", () => {
    expect(entryMatchesQuery(entry, "AGUA", label)).toBe(true);
    expect(entryMatchesQuery(entry, "lembre", label)).toBe(true);
    expect(entryMatchesQuery(entry, "pomodoro", label)).toBe(false);
    expect(entryMatchesQuery(entry, "  ", label)).toBe(true);
  });
});

describe("entry date helpers", () => {
  const at = (d: number, h: number) => new Date(2026, 9, d, h).getTime();
  const session = {
    kind: "session",
    id: "s1",
    segment_start_ms: at(14, 23),
    segment_end_ms: at(15, 1),
  } as unknown as CalendarEntry;
  const reminder = { kind: "reminder_occurrence", id: "r1", scheduled_for: at(14, 9) } as unknown as CalendarEntry;
  const habitDay = { kind: "habit_day", id: "h1", date: "2026-10-16" } as unknown as CalendarEntry;

  it("groups entries by their local start date in order", () => {
    const grouped = groupEntriesByDate([session, habitDay, reminder]);
    expect(grouped.get("2026-10-14")).toEqual([session, reminder]);
    expect(grouped.get("2026-10-16")).toEqual([habitDay]);
  });

  it("matches timed entries on the day they start and the day they end", () => {
    expect(entryOnDate(session, "2026-10-14")).toBe(true);
    expect(entryOnDate(session, "2026-10-15")).toBe(true);
    expect(entryOnDate(reminder, "2026-10-15")).toBe(false);
  });
});

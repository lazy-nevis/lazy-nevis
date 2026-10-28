import { describe, expect, it, vi } from "vitest";
import { downloadHabitsCsv } from "@/components/features/habits/exportHabits";

describe("exportHabits", () => {
  it("builds csv rows for export payload", () => {
    const click = vi.fn();
    const anchor = { click, href: "", download: "" } as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(anchor);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    downloadHabitsCsv(
      {
        habits: [],
        logs: [
          {
            habit_id: "h1",
            habit_name: "Water",
            target_id: "t1",
            metric: "volume",
            unit: "ml",
            value: 250,
            logged_at: "2024-01-01T10:00:00",
            note: "ok",
            source: "dialog",
          },
        ],
      },
      "water.csv",
    );

    expect(click).toHaveBeenCalled();
    expect(anchor.download).toBe("water.csv");
  });
});

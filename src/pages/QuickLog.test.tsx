import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { habitService, settingsService } from "@/services/tauri";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Habit, HabitDetail, HabitLog } from "@/types";
import { QuickLog } from "./QuickLog";

const { hideMock } = vi.hoisted(() => ({ hideMock: vi.fn(() => Promise.resolve()) }));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ hide: hideMock }),
}));

function makeHabit(id: string, name: string): Habit {
  return {
    id,
    name,
    description: null,
    tone: "blue",
    icon: "target",
    period: "daily",
    active: true,
    skip_reminders_when_met: false,
    channels: null,
    sound: null,
    sort_order: 0,
    created_at: 0,
    updated_at: 0,
    targets: [
      {
        id: `${id}-t`,
        habit_id: id,
        metric: "check",
        unit: "",
        target_value: 1,
        sort_order: 0,
        archived_at: null,
      },
    ],
    schedules: [],
  };
}

const water = makeHabit("water", "Drink water");
const reading = makeHabit("reading", "Read 20 pages");

beforeEach(async () => {
  vi.restoreAllMocks();
  hideMock.mockClear();
  await i18n.changeLanguage("en-US");
  vi.spyOn(settingsService, "get").mockResolvedValue(useSettingsStore.getState().settings);
  vi.spyOn(habitService, "takeQuickLogRequest").mockResolvedValue(null);
});

describe("QuickLog", () => {
  // Regression: the window said "No active habits yet" while active habits existed.
  it("lists active habits when opened without a target and logs the picked one", async () => {
    vi.spyOn(habitService, "list").mockResolvedValue([water, reading]);
    const log = vi.spyOn(habitService, "log").mockResolvedValue({} as HabitLog);
    render(<QuickLog />);

    fireEvent.click(await screen.findByRole("button", { name: /Read 20 pages/ }));
    expect(screen.queryByText(/No active habits yet/)).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(log).toHaveBeenCalledWith(
        "reading",
        expect.objectContaining({ source: "quick_log", trigger_event_id: null }),
      ),
    );
    expect(hideMock).toHaveBeenCalled();
  });

  it("opens the habit from a pending request that raced the open event", async () => {
    vi.spyOn(habitService, "list").mockResolvedValue([water, reading]);
    vi.spyOn(habitService, "takeQuickLogRequest").mockResolvedValueOnce({
      habit_id: "water",
      event_id: "evt-1",
    });
    const detail = vi
      .spyOn(habitService, "getDetail")
      .mockResolvedValue({ habit: water } as HabitDetail);
    render(<QuickLog />);

    expect(await screen.findByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(detail).toHaveBeenCalledWith("water");
    expect(screen.queryByRole("button", { name: /Read 20 pages/ })).not.toBeInTheDocument();
  });

  it("keeps the empty state when there are no active habits", async () => {
    vi.spyOn(habitService, "list").mockResolvedValue([]);
    render(<QuickLog />);

    expect(await screen.findByText(/No active habits yet/)).toBeInTheDocument();
  });
});

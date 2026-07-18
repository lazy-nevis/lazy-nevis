import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/i18n";
import { checklistService, sessionService, settingsService } from "@/services/tauri";
import { useChecklistStore } from "@/stores/checklistStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ChecklistItem, LiveStats, Session } from "@/types";
import { TrayPopover } from "./TrayPopover";

const session: Session = {
  id: "sess-1",
  label: "Deep work",
  started_at: Date.now(),
  ended_at: null,
  total_focus_ms: 0,
  total_distracted_ms: 0,
  total_idle_ms: 0,
  total_alerts: 0,
  notes: null,
  settings_snapshot: "{}",
};

const liveStats: LiveStats = {
  total_ms: 83_000,
  focus_ms: 60_000,
  distracted_ms: 13_000,
  idle_ms: 10_000,
  focus_percent: 72,
  alert_count: 0,
  is_distracted: false,
  is_paused: false,
  is_idle: false,
  on_break: false,
  current_app: "Code",
};

const item: ChecklistItem = {
  id: "item-1",
  title: "Review PR",
  created_at: Date.now(),
  completed_at: null,
  due_date: null,
  sort_order: 1,
  tags: [],
};

beforeEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage("en-US");
  useSessionStore.setState({ activeSession: null, liveStats: null, checkpoints: [], hydrationStatus: "ready" });
  useChecklistStore.setState({ openItems: [] });
  vi.spyOn(settingsService, "get").mockResolvedValue(useSettingsStore.getState().settings);
  // Echo the seeded store back so hydration doesn't wipe arranged state.
  vi.spyOn(sessionService, "getRuntime").mockImplementation(async () => {
    const current = useSessionStore.getState();
    return current.activeSession
      ? {
          session: current.activeSession,
          live_stats: current.liveStats ?? liveStats,
          checkpoints: [],
        }
      : null;
  });
  vi.spyOn(checklistService, "listOpen").mockImplementation(async () =>
    useChecklistStore.getState().openItems,
  );
});

describe("TrayPopover", () => {
  // Spec scenario: tray-quick-panel/start-with-name
  it("renders the start form when idle and starts a named session", async () => {
    const start = vi.spyOn(sessionService, "start").mockResolvedValue(session);
    render(<TrayPopover />);

    const nameInput = await screen.findByPlaceholderText("Session name (optional)");
    fireEvent.change(nameInput, { target: { value: "Deep work" } });
    fireEvent.click(screen.getByRole("button", { name: /Start/ }));

    await waitFor(() => expect(start).toHaveBeenCalledWith("Deep work"));
  });

  // Spec scenario: tray-quick-panel/pause-and-stop
  it("shows live stats and wires pause/stop to the session commands", async () => {
    useSessionStore.setState({ activeSession: session, liveStats });
    const pause = vi.spyOn(sessionService, "pause").mockResolvedValue();
    const stop = vi.spyOn(sessionService, "stop").mockResolvedValue({
      id: "sess-1", label: "Deep work", started_at: 0, ended_at: 1,
      total_focus_ms: 0, total_distracted_ms: 0, total_idle_ms: 0,
      total_alerts: 0, focus_percent: 0,
    });
    render(<TrayPopover />);

    expect(await screen.findByText("Deep work")).toBeInTheDocument();
    expect(screen.getByText("Code")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(pause).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "End Session" }));
    await waitFor(() => expect(stop).toHaveBeenCalledOnce());
  });

  // Spec scenario: tray-quick-panel/complete-from-the-panel
  it("completes a checklist item from the compact list", async () => {
    useChecklistStore.setState({ openItems: [item] });
    const complete = vi
      .spyOn(checklistService, "complete")
      .mockResolvedValue({ ...item, completed_at: Date.now() });
    render(<TrayPopover />);

    fireEvent.click(await screen.findByRole("button", { name: "Mark as done" }));
    await waitFor(() => expect(complete).toHaveBeenCalledWith("item-1"));
  });
});

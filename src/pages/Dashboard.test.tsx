import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/i18n";
import { useFocusSession } from "@/hooks/useFocusSession";
import { sessionService } from "@/services/tauri";
import { useSessionStore } from "@/stores/sessionStore";
import type { LiveStats, Session } from "@/types";
import { Dashboard } from "./Dashboard";

vi.mock("@/hooks/useFocusSession", () => ({ useFocusSession: vi.fn() }));

const session: Session = {
  id: "session-1",
  label: "Focus",
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
  total_ms: 1_000,
  focus_ms: 1_000,
  distracted_ms: 0,
  idle_ms: 0,
  focus_percent: 100,
  alert_count: 0,
  is_distracted: false,
  is_paused: false,
  is_idle: false,
  on_break: false,
  current_app: "Code",
};

describe("Dashboard break lifecycle", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("en-US");
    useSessionStore.setState({
      activeSession: session,
      liveStats,
      checkpoints: [],
      hydrationStatus: "ready",
      isOnBreak: false,
      breakStartedAt: null,
      breakReminderPending: true,
    });
    vi.mocked(useFocusSession).mockReturnValue({
      activeSession: session,
      liveStats,
      checkpoints: [],
      isActive: true,
      hydrationStatus: "ready",
      refreshSession: vi.fn(),
      startSession: vi.fn(),
      stopSession: vi.fn(),
      pauseSession: vi.fn(),
      addCheckpoint: vi.fn(),
    });
  });

  it("starts and manually ends a reminded break", async () => {
    const startBreak = vi.spyOn(sessionService, "startBreak").mockResolvedValue();
    const endBreak = vi.spyOn(sessionService, "endBreak").mockResolvedValue();
    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Start break" }));
    await waitFor(() => expect(startBreak).toHaveBeenCalledOnce());
    expect(await screen.findByRole("button", { name: "Back to work" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to work" }));
    await waitFor(() => expect(endBreak).toHaveBeenCalledOnce());
    expect(useSessionStore.getState().isOnBreak).toBe(false);
  });

  it("skips a reminder without starting a break", () => {
    const startBreak = vi.spyOn(sessionService, "startBreak").mockResolvedValue();
    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(startBreak).not.toHaveBeenCalled();
    expect(useSessionStore.getState().breakReminderPending).toBe(false);
  });

  it("ends an expired break automatically", async () => {
    const endBreak = vi.spyOn(sessionService, "endBreak").mockResolvedValue();
    useSessionStore.setState({
      isOnBreak: true,
      breakStartedAt: Date.now() - 601_000,
      breakReminderPending: false,
    });
    render(<Dashboard />);

    await waitFor(() => expect(endBreak).toHaveBeenCalledOnce());
    expect(useSessionStore.getState().isOnBreak).toBe(false);
  });
});

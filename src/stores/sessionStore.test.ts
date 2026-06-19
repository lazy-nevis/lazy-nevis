import { describe, it, expect, beforeEach } from "vitest";
import { useSessionStore } from "./sessionStore";
import type { Session, TickPayload } from "@/types";

const mockSession: Session = {
  id: "test-id",
  label: "Test",
  started_at: Date.now(),
  ended_at: null,
  total_focus_ms: 0,
  total_distracted_ms: 0,
  total_idle_ms: 0,
  total_alerts: 0,
  notes: null,
  settings_snapshot: "{}",
};

describe("sessionStore", () => {
  beforeEach(() => {
    useSessionStore.setState({
      activeSession: null,
      liveStats: null,
      checkpoints: [],
    });
  });

  it("sets active session", () => {
    useSessionStore.getState().setActiveSession(mockSession);
    expect(useSessionStore.getState().activeSession).toEqual(mockSession);
  });

  it("clears active session", () => {
    useSessionStore.getState().setActiveSession(mockSession);
    useSessionStore.getState().setActiveSession(null);
    expect(useSessionStore.getState().activeSession).toBeNull();
  });

  it("adds checkpoints", () => {
    const cp = { id: "cp1", session_id: "test-id", created_at: Date.now(), label: "After lunch" };
    useSessionStore.getState().addCheckpoint(cp);
    expect(useSessionStore.getState().checkpoints).toHaveLength(1);
    expect(useSessionStore.getState().checkpoints[0].label).toBe("After lunch");
  });

  it("resets checkpoints", () => {
    const cp = { id: "cp1", session_id: "test-id", created_at: Date.now(), label: null };
    useSessionStore.getState().addCheckpoint(cp);
    useSessionStore.getState().resetCheckpoints();
    expect(useSessionStore.getState().checkpoints).toHaveLength(0);
  });

  it("updates live stats from tick", () => {
    useSessionStore.setState({
      liveStats: {
        total_ms: 1000,
        focus_ms: 800,
        distracted_ms: 200,
        idle_ms: 0,
        focus_percent: 80,
        alert_count: 0,
        is_distracted: false,
        is_paused: false,
        current_app: null,
      },
    });

    const tick: TickPayload = {
      session_id: "test-id",
      focus_ms: 1500,
      distracted_ms: 300,
      total_ms: 2_000,
      focus_percent: 75,
      alert_count: 1,
      is_distracted: true,
      is_paused: false,
      is_idle: false,
      idle_ms: 200,
      current_app: "YouTube",
      current_title: "cat videos",
    };

    useSessionStore.getState().updateFromTick(tick);
    const stats = useSessionStore.getState().liveStats;
    expect(stats?.focus_ms).toBe(1500);
    expect(stats?.is_distracted).toBe(true);
    expect(stats?.current_app).toBe("YouTube");
    expect(stats?.total_ms).toBe(2_000);
    expect(stats?.focus_percent).toBe(75);
  });

  it("hydrates an active runtime atomically", () => {
    useSessionStore.getState().hydrateRuntime({
      session: mockSession,
      live_stats: {
        total_ms: 10_000,
        focus_ms: 6_000,
        distracted_ms: 2_000,
        idle_ms: 2_000,
        focus_percent: 60,
        alert_count: 1,
        is_distracted: false,
        is_paused: true,
        is_idle: false,
        current_app: "Code",
      },
      checkpoints: [],
    });

    const state = useSessionStore.getState();
    expect(state.activeSession?.id).toBe(mockSession.id);
    expect(state.liveStats?.focus_percent).toBe(60);
    expect(state.liveStats?.is_paused).toBe(true);
    expect(state.hydrationStatus).toBe("ready");
  });

  it("tracks break reminders and backend break state without counting it", () => {
    useSessionStore.getState().setBreakReminderPending(true);
    expect(useSessionStore.getState().breakReminderPending).toBe(true);
    useSessionStore.getState().updateFromTick({
      session_id: "test-id",
      focus_ms: 1_000,
      distracted_ms: 0,
      idle_ms: 0,
      total_ms: 1_000,
      focus_percent: 100,
      alert_count: 0,
      is_distracted: false,
      is_paused: false,
      is_idle: false,
      on_break: true,
      current_app: null,
      current_title: null,
    });
    expect(useSessionStore.getState().isOnBreak).toBe(true);
    expect(useSessionStore.getState().liveStats?.total_ms).toBe(1_000);
    useSessionStore.getState().setOnBreak(false);
    expect(useSessionStore.getState().isOnBreak).toBe(false);
  });
});

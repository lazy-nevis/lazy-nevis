import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { useFocusSession } from "./useFocusSession";
import { useSessionStore } from "@/stores/sessionStore";
import * as tauriService from "@/services/tauri";
import type { Session } from "@/types";

const mockSession: Session = {
  id: "sess-1",
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

beforeEach(() => {
  useSessionStore.setState({ activeSession: null, liveStats: null, checkpoints: [], hydrationStatus: "loading" });
  vi.clearAllMocks();
  vi.spyOn(tauriService.sessionService, "getRuntime").mockImplementation(async () => {
    const session = useSessionStore.getState().activeSession;
    return session ? {
      session,
      live_stats: {
        total_ms: 0,
        focus_ms: 0,
        distracted_ms: 0,
        idle_ms: 0,
        focus_percent: 100,
        alert_count: 0,
        is_distracted: false,
        is_paused: false,
        is_idle: false,
        current_app: null,
      },
      checkpoints: useSessionStore.getState().checkpoints,
    } : null;
  });
});

describe("useFocusSession", () => {
  it("startSession sets activeSession in the store", async () => {
    vi.spyOn(tauriService.sessionService, "start").mockResolvedValue(mockSession);

    const { result } = renderHook(() => useFocusSession());

    expect(result.current.isActive).toBe(false);

    await act(async () => {
      await result.current.startSession("Test");
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.activeSession?.id).toBe("sess-1");
  });

  it("stopSession clears activeSession", async () => {
    useSessionStore.setState({
      activeSession: mockSession,
      liveStats: null,
      checkpoints: [],
    });

    vi.spyOn(tauriService.sessionService, "stop").mockResolvedValue({
      id: "sess-1",
      label: null,
      started_at: Date.now(),
      ended_at: Date.now(),
      total_focus_ms: 1000,
      total_distracted_ms: 500,
      total_idle_ms: 250,
      total_alerts: 0,
      focus_percent: 66,
    });

    const { result } = renderHook(() => useFocusSession());
    expect(result.current.isActive).toBe(true);

    await act(async () => {
      await result.current.stopSession();
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.activeSession).toBeNull();
  });

  it("pauseSession calls the backend pause command", async () => {
    useSessionStore.setState({ activeSession: mockSession, liveStats: null, checkpoints: [] });
    const pauseSpy = vi.spyOn(tauriService.sessionService, "pause").mockResolvedValue();

    const { result } = renderHook(() => useFocusSession());

    await act(async () => {
      await result.current.pauseSession();
    });

    expect(pauseSpy).toHaveBeenCalledOnce();
  });

  it("addCheckpoint appends to checkpoints in store", async () => {
    useSessionStore.setState({ activeSession: mockSession, liveStats: null, checkpoints: [] });

    vi.spyOn(tauriService.sessionService, "addCheckpoint").mockResolvedValue({
      id: "cp-1",
      session_id: "sess-1",
      created_at: Date.now(),
      label: "After lunch",
    });

    const { result } = renderHook(() => useFocusSession());

    await act(async () => {
      await result.current.addCheckpoint("After lunch");
    });

    expect(result.current.checkpoints).toHaveLength(1);
    expect(result.current.checkpoints[0].label).toBe("After lunch");
  });

  it("startSession resets checkpoints", async () => {
    useSessionStore.setState({
      activeSession: null,
      liveStats: null,
      checkpoints: [{ id: "old", session_id: "old-sess", created_at: 0, label: null }],
    });

    vi.spyOn(tauriService.sessionService, "start").mockResolvedValue(mockSession);

    const { result } = renderHook(() => useFocusSession());

    await act(async () => {
      await result.current.startSession();
    });

    expect(result.current.checkpoints).toHaveLength(0);
  });

  it("registers one listener per event and removes all listeners on cleanup", async () => {
    const cleanups: Array<ReturnType<typeof vi.fn>> = [];
    vi.mocked(listen).mockImplementation(async () => {
      const cleanup = vi.fn();
      cleanups.push(cleanup);
      return cleanup;
    });

    const { unmount } = renderHook(() => useFocusSession());
    await waitFor(() => expect(listen).toHaveBeenCalledTimes(8));

    const events = vi.mocked(listen).mock.calls.map(([event]) => event);
    expect(new Set(events).size).toBe(events.length);
    unmount();
    expect(cleanups).toHaveLength(8);
    expect(cleanups.every((cleanup) => cleanup.mock.calls.length === 1)).toBe(true);
  });
});

import { create } from "zustand";
import type { ActiveSessionRuntime, Checkpoint, LiveStats, Session, TickPayload } from "@/types";

export type SessionHydrationStatus = "loading" | "ready" | "error";

const EMPTY_LIVE_STATS: LiveStats = {
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
};

interface SessionStore {
  activeSession: Session | null;
  liveStats: LiveStats | null;
  checkpoints: Checkpoint[];
  isOnBreak: boolean;
  breakStartedAt: number | null;
  breakReminderPending: boolean;
  hydrationStatus: SessionHydrationStatus;
  setActiveSession: (session: Session | null) => void;
  setLiveStats: (stats: LiveStats | null) => void;
  updateFromTick: (tick: TickPayload) => void;
  addCheckpoint: (checkpoint: Checkpoint) => void;
  resetCheckpoints: () => void;
  setOnBreak: (on: boolean) => void;
  setBreakReminderPending: (pending: boolean) => void;
  hydrateRuntime: (runtime: ActiveSessionRuntime | null) => void;
  setHydrationStatus: (status: SessionHydrationStatus) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  activeSession: null,
  liveStats: null,
  checkpoints: [],
  isOnBreak: false,
  breakStartedAt: null,
  breakReminderPending: false,
  hydrationStatus: "loading",

  setActiveSession: (session) =>
    set({
      activeSession: session,
      // FIX: initialize liveStats when session starts so updateFromTick works
      liveStats: session ? { ...EMPTY_LIVE_STATS } : null,
      hydrationStatus: "ready",
    }),

  setLiveStats: (stats) => set({ liveStats: stats }),

  // FIX: always update liveStats even if it starts null (was dropping all ticks)
  updateFromTick: (tick) =>
    set((state) => ({
      liveStats: {
        ...(state.liveStats ?? EMPTY_LIVE_STATS),
        focus_ms: tick.focus_ms,
        distracted_ms: tick.distracted_ms,
        total_ms: tick.total_ms,
        focus_percent: tick.focus_percent,
        idle_ms: tick.idle_ms ?? 0,
        alert_count: tick.alert_count,
        is_distracted: tick.is_distracted,
        is_paused: tick.is_paused,
        is_idle: tick.is_idle ?? false,
        on_break: tick.on_break ?? false,
        current_app: tick.current_app,
      },
      isOnBreak: tick.on_break ?? false,
      breakStartedAt: tick.on_break
        ? state.breakStartedAt ?? Date.now()
        : null,
    })),

  addCheckpoint: (checkpoint) =>
    set((state) => ({ checkpoints: [...state.checkpoints, checkpoint] })),

  resetCheckpoints: () => set({ checkpoints: [] }),

  setOnBreak: (on) =>
    set({ isOnBreak: on, breakStartedAt: on ? Date.now() : null, breakReminderPending: false }),

  setBreakReminderPending: (breakReminderPending) => set({ breakReminderPending }),

  hydrateRuntime: (runtime) =>
    set({
      activeSession: runtime?.session ?? null,
      liveStats: runtime?.live_stats ?? null,
      checkpoints: runtime?.checkpoints ?? [],
      isOnBreak: false,
      breakStartedAt: null,
      breakReminderPending: false,
      hydrationStatus: "ready",
    }),

  setHydrationStatus: (hydrationStatus) => set({ hydrationStatus }),
}));

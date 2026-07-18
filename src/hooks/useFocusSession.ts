import { useCallback, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { overlayService, sessionService } from "@/services/tauri";
import { notifyManager } from "@/services/notifications";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { audioService } from "@/services/tauri";
import type { AlertPayload, SessionLifecyclePayload, TickPayload } from "@/types";
import { formatDurationHuman } from "@/utils/formatters";

interface BreakReminderPayload {
  session_id: string;
  focused_ms: number;
  alert_type: string;
}

// ── Singleton guard ─────────────────────────────────────────────────────────
// Prevents duplicate listener registration when the hook is called from
// multiple components (e.g. AppShell + CloseWarningDialog).
let listenersRegistered = false;

export function useFocusSession() {
  const { t } = useTranslation();
  const {
    activeSession, liveStats, checkpoints,
    setActiveSession, updateFromTick, addCheckpoint, resetCheckpoints,
    hydrationStatus, hydrateRuntime, setHydrationStatus,
  } = useSessionStore();
  const { addToast } = useUiStore();

  // Use refs for settings/t so the effect can read fresh values without re-registering
  const settings = useSettingsStore((s) => s.settings);
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  const shortcutLock = useRef(false);

  const refreshSession = useCallback(async () => {
    const stateBefore = useSessionStore.getState();
    const wasReady = stateBefore.hydrationStatus === "ready";
    const sessionIdBefore = stateBefore.activeSession?.id ?? null;
    if (!wasReady) setHydrationStatus("loading");
    try {
      const runtime = await sessionService.getRuntime();
      const currentSessionId = useSessionStore.getState().activeSession?.id ?? null;
      if (currentSessionId !== sessionIdBefore) return;
      hydrateRuntime(runtime);
    } catch {
      if (!wasReady) setHydrationStatus("error");
    }
  }, [hydrateRuntime, setHydrationStatus]);

  useEffect(() => {
    // Strict Mode / double-mount guard — only register once per app lifetime
    if (listenersRegistered) return;
    listenersRegistered = true;

    // Track whether this effect instance has been cleaned up
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    const setup = async () => {
      // ── session:tick ──────────────────────────────────────────────────────
      const unTick = await listen<TickPayload>("session:tick", (ev) => {
        updateFromTick(ev.payload);
      });
      if (cancelled) { unTick(); return; }
      cleanups.push(unTick);

      // ── alert:show (notification type) ───────────────────────────────────
      const unNotif = await listen<AlertPayload>("alert:show", async (ev) => {
        const { app_name, distracted_ms, alert_type } = ev.payload;
        const cfg = settingsRef.current;
        const timeStr = formatDurationHuman(distracted_ms, cfg.general.language);

        if (alert_type === "notification") {
          if (cfg.audio.notification_sound_enabled) {
            audioService.play(cfg.audio.notification_sound, cfg.audio.volume, false).catch(() => {});
          }
          await notifyManager.notify(
            tRef.current("alerts.notification_title"),
            tRef.current("alerts.notification_body", { app: app_name, time: timeStr }),
          );
        }
      });
      if (cancelled) { unNotif(); return; }
      cleanups.push(unNotif);

      // ── alert:fullscreen (overlay type) ──────────────────────────────────
      // The dedicated overlay window is shown by Rust. This listener only
      // owns the looping alert sound so it can use current user settings.
      const unFullscreen = await listen<AlertPayload>("alert:fullscreen", async (ev) => {
        const { alert_type } = ev.payload;
        const cfg = settingsRef.current;

        if (cfg.audio.fullscreen_sound_enabled) {
          audioService.play(cfg.audio.fullscreen_sound, cfg.audio.volume, true).catch(() => {});
        }

        void alert_type;
      });
      if (cancelled) { unFullscreen(); return; }
      cleanups.push(unFullscreen);

      // ── break:reminder ────────────────────────────────────────────────────
      const unBreak = await listen<BreakReminderPayload>("break:reminder", async (ev) => {
        const { focused_ms, alert_type } = ev.payload;
        const timeStr = formatDurationHuman(
          focused_ms,
          settingsRef.current.general.language,
        );
        if (alert_type === "notification") {
          await notifyManager.notify(
            tRef.current("alerts.break_notification_title"),
            tRef.current("alerts.break_notification_body", { time: timeStr }),
          );
        }
        if (alert_type === "fullscreen") {
          overlayService.show(tRef.current("alerts.break_app"), focused_ms, false).catch(() => {});
        }
        useSessionStore.getState().setBreakReminderPending(true);
      });
      if (cancelled) { unBreak(); return; }
      cleanups.push(unBreak);

      // ── Session lifecycle feedback ────────────────────────────────────────
      // Emitted by Rust for every entry point (UI, shortcut, tray). Rust only
      // delivers the notification when the main window is hidden/unfocused,
      // so in-app actions stay quiet.
      // Spec: notification-feedback/shortcut-trigger-while-app-inactive.
      const lifecycleEvents = [
        ["session:started", "started"],
        ["session:paused", "paused"],
        ["session:resumed", "resumed"],
        ["session:stopped", "stopped"],
      ] as const;
      for (const [eventName, kind] of lifecycleEvents) {
        const unLifecycle = await listen<SessionLifecyclePayload>(eventName, async (ev) => {
          const cfg = settingsRef.current;
          if (!cfg.alerts.session_feedback_notifications) return;
          const label = ev.payload.label ?? tRef.current("notifications.unnamed_session");
          await notifyManager.notifyIfInactive(
            tRef.current(`notifications.session_${kind}_title`),
            tRef.current(`notifications.session_${kind}_body`, {
              label,
              time: formatDurationHuman(ev.payload.elapsed_ms, cfg.general.language),
            }),
          );
        });
        if (cancelled) { unLifecycle(); return; }
        cleanups.push(unLifecycle);
      }

      // ── Shortcuts ─────────────────────────────────────────────────────────
      const handleToggle = async () => {
        if (shortcutLock.current) return;
        shortcutLock.current = true;
        try {
          const active = await sessionService.getActive();
          if (active) {
            await sessionService.pause();
            const paused = !useSessionStore.getState().liveStats?.is_paused;
            useUiStore.getState().addToast(
              tRef.current(paused ? "dashboard.session.paused_toast" : "dashboard.session.resumed_toast"),
              "info",
            );
          } else {
            const session = await sessionService.start();
            setActiveSession(session);
            resetCheckpoints();
            useUiStore.getState().addToast(
              tRef.current("dashboard.session.status_focused"),
              "info",
            );
          }
        } catch { /* */ } finally {
          setTimeout(() => { shortcutLock.current = false; }, 800);
        }
      };

      const unToggle = await listen("shortcut:toggle_focus", handleToggle);
      if (cancelled) { unToggle(); return; }
      cleanups.push(unToggle);

      const unStop = await listen("shortcut:stop_session", async () => {
        if (shortcutLock.current) return;
        shortcutLock.current = true;
        try {
          await sessionService.stop();
          await overlayService.cancelActive().catch(() => {});
          setActiveSession(null);
          resetCheckpoints();
          useUiStore.getState().addToast(tRef.current("dashboard.session.saved"), "success");
        } catch { /* */ } finally {
          setTimeout(() => { shortcutLock.current = false; }, 800);
        }
      });
      if (cancelled) { unStop(); return; }
      cleanups.push(unStop);

      const unCheckpoint = await listen("shortcut:add_checkpoint", async () => {
        const active = await sessionService.getActive().catch(() => null);
        if (!active) return;
        const cp = await sessionService.addCheckpoint(tRef.current("dashboard.checkpoints.shortcut_label")).catch(() => null);
        if (cp) addCheckpoint(cp);
      });
      if (cancelled) { unCheckpoint(); return; }
      cleanups.push(unCheckpoint);

      // ── app:close_requested ───────────────────────────────────────────────
      const unClose = await listen("app:close_requested", () => {
        useUiStore.getState().setCloseWarningOpen(true);
      });
      if (cancelled) { unClose(); return; }
      cleanups.push(unClose);

      await refreshSession();
      if (cancelled) return;

      const handleWindowFocus = () => { void refreshSession(); };
      window.addEventListener("focus", handleWindowFocus);
      cleanups.push(() => window.removeEventListener("focus", handleWindowFocus));
    };

    setup().catch(console.error);

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
      listenersRegistered = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Stable — settings/t accessed via refs

  const startSession = useCallback(async (label?: string) => {
    try {
      const session = await sessionService.start(label);
      setActiveSession(session);
      resetCheckpoints();
      addToast(tRef.current("dashboard.session.status_focused"), "info");
    } catch (err) {
      if (String(err).includes("SessionAlreadyActive")) {
        addToast(tRef.current("dashboard.session.already_active"), "info");
      } else {
        addToast(tRef.current("common.error"), "error");
        throw err;
      }
    }
  }, [setActiveSession, resetCheckpoints, addToast]);

  const stopSession = useCallback(async (notes?: string) => {
    try {
      await sessionService.stop(notes);
      await overlayService.cancelActive().catch(() => {});
      setActiveSession(null);
      resetCheckpoints();
      addToast(tRef.current("dashboard.session.saved"), "success");
    } catch {
      addToast(tRef.current("common.error"), "error");
    }
  }, [setActiveSession, resetCheckpoints, addToast]);

  const pauseSession = useCallback(async () => {
    try { await sessionService.pause(); }
    catch { addToast(tRef.current("common.error"), "error"); }
  }, [addToast]);

  const addCheckpointAction = useCallback(async (label?: string) => {
    try {
      const cp = await sessionService.addCheckpoint(label);
      addCheckpoint(cp);
    } catch { addToast(tRef.current("common.error"), "error"); }
  }, [addCheckpoint, addToast]);

  return {
    activeSession,
    liveStats,
    checkpoints,
    isActive: !!activeSession,
    hydrationStatus,
    refreshSession,
    startSession,
    stopSession,
    pauseSession,
    addCheckpoint: addCheckpointAction,
  };
}

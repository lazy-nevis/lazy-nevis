import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Monitor, Pause, Play, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChecklistItemRow } from "@/components/features/checklist/ChecklistItemRow";
import { ChecklistInput } from "@/components/features/checklist/ChecklistInput";
import { useChecklist } from "@/hooks/useChecklist";
import { useThemeSync } from "@/hooks/useThemeSync";
import { sessionService } from "@/services/tauri";
import { settingsService } from "@/services/tauri";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { AppSettings, TickPayload } from "@/types";
import { formatDuration } from "@/utils/formatters";

/**
 * Tray quick panel — its own webview (label "tray"), rendered without AppShell
 * and without useFocusSession: the main window stays the only side-effect owner.
 * Reads live state via global events and the same commands as the main window.
 * Spec: tray-quick-panel.
 */
export function TrayPopover() {
  const { t } = useTranslation();
  const { activeSession, liveStats, setActiveSession, updateFromTick, hydrateRuntime } =
    useSessionStore();
  const {
    openView,
    graceMs,
    completeItem,
    uncompleteItem,
    createItem,
    refresh: refreshChecklist,
  } = useChecklist();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  // The panel follows the app theme (spec: tray-quick-panel/follows-theme).
  useThemeSync();

  // Transparent window chrome: the rounded container + native blur do the rest
  // (spec: tray-quick-panel/native-popover-look).
  useEffect(() => {
    document.documentElement.classList.add("tray-window");
    document.body.classList.add("tray-window");
    return () => {
      document.documentElement.classList.remove("tray-window");
      document.body.classList.remove("tray-window");
    };
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      hydrateRuntime(await sessionService.getRuntime());
    } catch {
      /* backend unavailable */
    }
  }, [hydrateRuntime]);

  // Hydrate settings (language, grace period) — this window has its own JS context.
  useEffect(() => {
    settingsService
      .get()
      .then((settings) => {
        useSettingsStore.getState().setSettings(settings);
        void i18n.changeLanguage(settings.general.language);
      })
      .catch(() => undefined);
    void refreshSession();
  }, [refreshSession]);

  // Live updates: ticks, lifecycle, settings (spec: tray-quick-panel/language-switch-while-open).
  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    const register = async () => {
      const unTick = await listen<TickPayload>("session:tick", (ev) => {
        updateFromTick(ev.payload);
      });
      if (cancelled) return unTick();
      cleanups.push(unTick);

      for (const eventName of ["session:started", "session:stopped", "session:paused", "session:resumed"]) {
        const un = await listen(eventName, () => void refreshSession());
        if (cancelled) return un();
        cleanups.push(un);
      }

      const unSettings = await listen<AppSettings>("settings:changed", (ev) => {
        useSettingsStore.getState().setSettings(ev.payload);
        void i18n.changeLanguage(ev.payload.general.language);
      });
      if (cancelled) return unSettings();
      cleanups.push(unSettings);
    };
    register().catch(() => undefined);
    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [updateFromTick, refreshSession]);

  // Re-hydrate whenever the panel is (re)shown.
  useEffect(() => {
    const onFocus = () => {
      void refreshSession();
      void refreshChecklist();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshSession, refreshChecklist]);

  const startSession = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const session = await sessionService.start(name.trim() || undefined);
      setActiveSession(session);
      setName("");
    } catch {
      /* already active or backend error — next tick reconciles */
    } finally {
      setBusy(false);
    }
  };

  const isPaused = liveStats?.is_paused ?? false;

  return (
    // Lower opacity + backdrop-blur so the native vibrancy shows through more
    // (liquid-glass look); backdrop-blur is a no-op on the Linux opaque fallback.
    <div className="flex h-screen flex-col overflow-hidden rounded-xl border border-border/50 bg-background/55 text-foreground backdrop-blur-2xl">
      {/* Session block */}
      <div className="border-b p-3">
        {activeSession ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm font-medium">
                {activeSession.label ?? t("notifications.unnamed_session")}
              </p>
              <span className="font-mono text-sm font-bold tabular-nums">
                {formatDuration(liveStats?.total_ms ?? 0)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center text-[11px] text-muted-foreground">
              <div>
                <p className="font-mono tabular-nums text-foreground">
                  {formatDuration(liveStats?.focus_ms ?? 0)}
                </p>
                {t("tray_panel.focus")}
              </div>
              <div>
                <p className="font-mono tabular-nums text-foreground">
                  {formatDuration(liveStats?.distracted_ms ?? 0)}
                </p>
                {t("tray_panel.distracted")}
              </div>
              <div>
                <p className="font-mono tabular-nums text-foreground">
                  {formatDuration(liveStats?.idle_ms ?? 0)}
                </p>
                {t("tray_panel.idle")}
              </div>
            </div>
            {liveStats?.current_app && (
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <Monitor className="h-3 w-3 shrink-0" />
                {liveStats.current_app}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={() => void sessionService.pause()}
              >
                {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                {isPaused ? t("dashboard.session.resume_button") : t("dashboard.session.pause_button")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 gap-1.5"
                onClick={() => {
                  void sessionService.stop().then(() => setActiveSession(null)).catch(() => {});
                }}
              >
                <Square className="h-3.5 w-3.5" />
                {t("dashboard.session.stop_button")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void startSession();
              }}
              placeholder={t("tray_panel.session_name_placeholder")}
              className="h-8 text-sm"
            />
            <Button size="sm" className="w-full gap-1.5" disabled={busy} onClick={() => void startSession()}>
              <Play className="h-3.5 w-3.5" />
              {t("dashboard.session.start_button")}
            </Button>
          </div>
        )}
      </div>

      {/* Compact checklist (spec: tray-quick-panel/complete-from-the-panel) */}
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("checklist.open_title")}
        </p>
        {/* -mr/pr let the scrollbar live in the section padding so rows keep the
            block's full width (aligned with the session button above). */}
        <div className="-mr-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-2 [scrollbar-gutter:stable]">
          {openView.length === 0 && (
            <p className="py-3 text-center text-xs text-muted-foreground">
              {t("checklist.empty_open")}
            </p>
          )}
          {openView.map((entry) => (
            <ChecklistItemRow
              key={entry.item.id}
              entry={entry}
              graceMs={graceMs}
              compact
              onToggleComplete={(item) => void completeItem(item.id)}
              onUndo={(item) => void uncompleteItem(item.id)}
            />
          ))}
          <ChecklistInput onCreate={createItem} />
        </div>

        {/* Small brand mark so the floating panel is identifiable
            (spec: tray-quick-panel/brand-footer). */}
        <div className="mt-1 flex justify-end pt-1">
          <BrandLogo className="h-4 opacity-60" />
        </div>
      </div>
    </div>
  );
}

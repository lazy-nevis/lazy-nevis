import { Suspense, lazy, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { ChecklistHistory } from "@/components/features/checklist/ChecklistHistory";
import { TitleBar } from "@/components/layout/TitleBar";
import { ToastContainer } from "@/components/layout/ToastContainer";
import { useSettings } from "@/hooks/useSettings";
import { useThemeSync } from "@/hooks/useThemeSync";
import { useWindowTitle } from "@/hooks/useWindowTitle";
import { checklistService, settingsService } from "@/services/tauri";
import { useSettingsStore } from "@/stores/settingsStore";
import type { AppSettings, ChecklistSortMode } from "@/types";

const SettingsPage = lazy(() => import("@/pages/Settings").then((m) => ({ default: m.Settings })));
const HistoryPage = lazy(() => import("@/pages/History").then((m) => ({ default: m.History })));
const AboutPage = lazy(() => import("@/pages/About").then((m) => ({ default: m.About })));

type Pane = "settings" | "history" | "checklist-history" | "about";

function isPane(value: string | null): value is Pane {
  return (
    value === "settings" || value === "history" || value === "checklist-history" || value === "about"
  );
}

function parsePane(search: string): Pane {
  const pane = new URLSearchParams(search).get("pane");
  return isPane(pane) ? pane : "settings";
}

function ChecklistHistoryPane() {
  const { t } = useTranslation();
  const { settings, saveSettings } = useSettings();

  const persistSort = (sort: ChecklistSortMode) => {
    saveSettings(
      { ...settings, checklist: { ...settings.checklist, history_sort: sort } },
      { silent: true },
    );
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-base font-semibold">{t("checklist.history_title")}</h1>
        <ChecklistHistory
          onSortPersist={persistSort}
          onRestore={(id) => void checklistService.uncomplete(id).catch(() => {})}
        />
      </div>
    </div>
  );
}

/**
 * Reusable secondary window (label "secondary") used by Compact Mode so the
 * docked main window is never disturbed. No AppShell / useFocusSession — the
 * main window remains the side-effect owner. Spec: app-modes.
 */
const PANE_TITLE_KEYS: Record<Pane, string> = {
  settings: "nav.settings",
  history: "nav.history",
  "checklist-history": "checklist.history_title",
  about: "nav.about",
};

export function SecondaryShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const [pane, setPane] = useState<Pane>(() => parsePane(location.search));
  useThemeSync();

  // "LazyNevis — <pane>" so the floating window says what it shows
  // (spec: app-modes/window-titles).
  useWindowTitle(t(PANE_TITLE_KEYS[pane]));

  // Hydrate settings/language for this window's own JS context.
  useEffect(() => {
    settingsService
      .get()
      .then((settings) => {
        useSettingsStore.getState().setSettings(settings);
        void i18n.changeLanguage(settings.general.language);
      })
      .catch(() => undefined);
  }, []);

  // The window is pre-created hidden at startup; warming every pane chunk here
  // makes pane switches instant too (spec: app-modes/instant-secondary-window).
  useEffect(() => {
    void import("@/pages/Settings");
    void import("@/pages/History");
    void import("@/pages/About");
  }, []);

  // Reused window navigation (spec: app-modes/open-settings-without-disturbing-the-dock).
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    listen<{ pane: string }>("secondary:navigate", (ev) => {
      const next = ev.payload.pane;
      if (isPane(next)) {
        setPane(next);
      }
    }).then((un) => {
      if (cancelled) un();
      else unlisten = un;
    });
    const unSettingsPromise = listen<AppSettings>("settings:changed", (ev) => {
      useSettingsStore.getState().setSettings(ev.payload);
      void i18n.changeLanguage(ev.payload.general.language);
    });
    return () => {
      cancelled = true;
      unlisten?.();
      void unSettingsPromise.then((un) => un());
    };
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Custom macOS title bar showing the active pane
          (spec: app-modes/custom-title-bar). */}
      <TitleBar title={t(PANE_TITLE_KEYS[pane])} />
      <div className="min-h-0 flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          }
        >
          {pane === "settings" && <SettingsPage />}
          {pane === "history" && <HistoryPage />}
          {pane === "checklist-history" && <ChecklistHistoryPane />}
          {pane === "about" && <AboutPage />}
        </Suspense>
      </div>
      <ToastContainer />
    </div>
  );
}

import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { settingsService, trayService } from "@/services/tauri";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import type { AppSettings } from "@/types";

/** Push localized tray labels to Rust (spec: tray-status/language-change). */
function pushTrayLabels() {
  trayService
    .setLabels({
      show: i18n.t("tray.show"),
      toggle_focus: i18n.t("tray.toggle_focus"),
      stop_session: i18n.t("tray.stop_session"),
      quit: i18n.t("tray.quit"),
      state_idle: i18n.t("tray.state_idle"),
      state_running: i18n.t("tray.state_running"),
      state_paused: i18n.t("tray.state_paused"),
      open_quick_panel: i18n.t("tray.open_quick_panel"),
    })
    .catch(() => undefined);
}

export function useSettings() {
  const { t } = useTranslation();
  const { settings, loaded, setSettings } = useSettingsStore();
  const { addToast } = useUiStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSettingsRef = useRef<AppSettings | null>(null);

  // Load settings on mount
  useEffect(() => {
    if (!loaded) {
      settingsService
        .get()
        .then(async (s) => {
          setSettings(s);
          await i18n.changeLanguage(s.general.language);
          pushTrayLabels();
          settingsService.getShortcutRegistrationStatus().then((statuses) => {
            if (statuses.some((status) => status.error)) {
              addToast(t("settings.shortcuts.startup_failed"), "error");
            }
          }).catch(() => undefined);
        })
        .catch(() => addToast(t("settings.load_failed"), "error"));
    }
  }, [loaded, setSettings, addToast, t]);

  const saveSettings = useCallback(
    async (updated: AppSettings, options?: { silent?: boolean }) => {
      setSettings(updated);
      const languageChanged = i18n.language !== updated.general.language;
      await i18n.changeLanguage(updated.general.language);
      if (languageChanged) pushTrayLabels();

      // Debounce saves to avoid hammering the DB on every keystroke
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      pendingSettingsRef.current = updated;
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await settingsService.save(updated);
          pendingSettingsRef.current = null;
          // Preference tweaks (e.g. history sort) persist without feedback
          // (spec: daily-checklist/sort-persistence).
          if (!options?.silent) addToast(t("settings.saved"));
        } catch (error) {
          addToast(
            String(error).toLowerCase().includes("shortcut")
              ? t("settings.shortcuts.save_failed")
              : t("settings.save_failed"),
            "error",
          );
        }
      }, 500);
    },
    [setSettings, addToast, t]
  );

  useEffect(() => () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (pendingSettingsRef.current) void settingsService.save(pendingSettingsRef.current);
  }, []);

  const resetSettings = useCallback(async () => {
    try {
      const defaults = await settingsService.reset();
      setSettings(defaults);
      await i18n.changeLanguage(defaults.general.language);
      pushTrayLabels();
      addToast(t("settings.saved"));
    } catch {
      addToast(t("common.error"), "error");
    }
  }, [setSettings, addToast, t]);

  return { settings, loaded, saveSettings, resetSettings };
}

import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { settingsService } from "@/services/tauri";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import type { AppSettings } from "@/types";

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
        .then((s) => {
          setSettings(s);
          i18n.changeLanguage(s.general.language);
          settingsService.getShortcutRegistrationError().then((error) => {
            if (error) addToast(t("settings.shortcuts.startup_failed"), "error");
          }).catch(() => undefined);
        })
        .catch(() => addToast(t("settings.load_failed"), "error"));
    }
  }, [loaded, setSettings, addToast, t]);

  const saveSettings = useCallback(
    async (updated: AppSettings) => {
      setSettings(updated);
      await i18n.changeLanguage(updated.general.language);

      // Debounce saves to avoid hammering the DB on every keystroke
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      pendingSettingsRef.current = updated;
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await settingsService.save(updated);
          pendingSettingsRef.current = null;
          addToast(t("settings.saved"));
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
      addToast(t("settings.saved"));
    } catch {
      addToast(t("common.error"), "error");
    }
  }, [setSettings, addToast, t]);

  return { settings, loaded, saveSettings, resetSettings };
}

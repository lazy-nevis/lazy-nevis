import { create } from "zustand";
import type { AppSettings } from "@/types";

const DEFAULT_SETTINGS: AppSettings = {
  general: {
    language: "en-US",
    theme: "system",
    polling_interval_ms: 1000,
    micro_event_threshold_ms: 3000,
    start_minimized: false,
    launch_at_login: false,
    time_format: "24h",
  },
  focus_rules: {
    mode: "blocklist",
    apps: [],
    browser_tab_mode: "blocklist",
    browser_tab_terms: ["YouTube", "Twitter", "Instagram", "Reddit", "TikTok"],
  },
  alerts: {
    notification_enabled: true,
    notification_threshold_ms: 30_000,
    fullscreen_enabled: false,
    fullscreen_threshold_ms: 60_000,
    cooldown_ms: 10_000,
  },
  audio: {
    notification_sound: "builtin:alert1.wav",
    fullscreen_sound: "builtin:alarm.wav",
    volume: 0.8,
    notification_sound_enabled: true,
    fullscreen_sound_enabled: true,
  },
  breaks: {
    enabled: false,
    focus_interval_ms: 3_000_000,
    break_duration_ms: 600_000,
    alert_type: "notification",
  },
  shortcuts: {
    toggle_focus: "CmdOrCtrl+Shift+F",
    stop_session: "CmdOrCtrl+Shift+S",
    open_home: "CmdOrCtrl+Shift+O",
    add_checkpoint: "CmdOrCtrl+Shift+C",
  },
};

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;
  setSettings: (settings: AppSettings) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  setSettings: (settings) => set({ settings, loaded: true }),

  updateSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
    })),
}));

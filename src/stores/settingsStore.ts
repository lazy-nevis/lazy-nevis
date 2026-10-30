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
    week_start: 1,
  },
  ui: {
    sidebar_collapsed: false,
  },
  focus_rules: {
    mode: "blocklist",
    apps: [],
    browser_tab_mode: "blocklist",
    browser_tab_terms: ["YouTube", "Twitter", "Instagram", "Reddit", "TikTok"],
    ignored_apps: [],
  },
  alerts: {
    notification_enabled: true,
    notification_threshold_ms: 30_000,
    fullscreen_enabled: false,
    fullscreen_threshold_ms: 60_000,
    cooldown_ms: 10_000,
    session_feedback_notifications: true,
  },
  delivery: {
    reminders: { notification: true, fullscreen: false, sound: true },
    habits: { notification: true, fullscreen: false, sound: false },
    pomodoro: { notification: true, fullscreen: false, sound: true },
    reminder_sound: "builtin:alert1.wav",
    habit_sound: "builtin:alert1.wav",
    pomodoro_sound: "builtin:alert1.wav",
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
    toggle_focus: "CmdOrCtrl+Alt+Shift+F",
    stop_session: "CmdOrCtrl+Alt+Shift+S",
    open_home: "CmdOrCtrl+Alt+Shift+O",
    add_checkpoint: "CmdOrCtrl+Alt+Shift+C",
  },
  pomodoro: {
    enabled: false,
    focus_ms: 25 * 60_000,
    short_break_ms: 5 * 60_000,
    long_break_ms: 15 * 60_000,
    long_break_every: 4,
    auto_start_breaks: true,
    auto_start_focus: false,
    link_focus_session: true,
    stop_session_with_run: true,
    daily_goal: 8,
  },
  checklist: {
    grace_period_ms: 10_000,
    history_sort: "created",
    group_by: [],
    category_filter: [],
    date_recognition: true,
  },
  calendar: {
    visible_kinds: [
      "session",
      "pomodoro_run",
      "checklist_completed",
      "checklist_due",
      "habit_log",
      "habit_day",
      "reminder_occurrence",
    ],
    default_view: "month",
  },
  app_mode: {
    mode: "full",
    pinned: false,
    full_geometry: null,
    compact_geometry: null,
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

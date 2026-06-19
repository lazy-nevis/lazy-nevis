import { invoke } from "@tauri-apps/api/core";
import type {
  AppSettings,
  ActiveSessionRuntime,
  Checkpoint,
  LiveStats,
  OverlayAlertPayload,
  Session,
  SessionStats,
  SessionSummary,
  WindowInfo,
} from "@/types";

// Session commands
export const sessionService = {
  start: (label?: string): Promise<Session> =>
    invoke("start_session", { args: { label: label ?? null } }),

  stop: (notes?: string): Promise<SessionSummary> =>
    invoke("stop_session", { notes: notes ?? null }),

  pause: (): Promise<void> => invoke("pause_session"),

  getActive: (): Promise<Session | null> => invoke("get_active_session"),

  getRuntime: (): Promise<ActiveSessionRuntime | null> =>
    invoke("get_session_runtime"),

  getLiveStats: (): Promise<LiveStats | null> => invoke("get_live_stats"),

  addCheckpoint: (label?: string): Promise<Checkpoint> =>
    invoke("add_checkpoint", { label: label ?? null }),

  list: (limit = 50, offset = 0): Promise<SessionSummary[]> =>
    invoke("list_sessions", { limit, offset }),

  listByRange: (from: number, to: number): Promise<SessionSummary[]> =>
    invoke("list_sessions_range", { from, to }),

  getDetail: (sessionId: string): Promise<SessionStats> =>
    invoke("get_session_detail", { sessionId }),

  delete: (sessionId: string): Promise<void> =>
    invoke("delete_session", { sessionId }),

  clearAll: (): Promise<void> => invoke("clear_all_data"),

  recordAlertDismissed: (alertType: string): Promise<void> =>
    invoke("record_alert_dismissed", { alertType }),

  startBreak: (): Promise<void> => invoke("start_break"),
  endBreak: (): Promise<void> => invoke("end_break"),

  updateEventClassification: (eventId: string, isDistraction: boolean): Promise<void> =>
    invoke("update_event_classification", { eventId, isDistraction }),
};

// Settings commands
export const settingsService = {
  get: (): Promise<AppSettings> => invoke("get_settings"),

  save: (settings: AppSettings): Promise<void> =>
    invoke("save_settings", { settings }),

  reset: (): Promise<AppSettings> => invoke("reset_settings"),

  getShortcutRegistrationError: (): Promise<string | null> =>
    invoke("get_shortcut_registration_error"),
};

export interface RecentAudioFile {
  path: string;
  label: string;
  added_at: number;
}

// Audio commands
export const audioService = {
  play: (source: string, volume: number, looping: boolean): Promise<void> =>
    invoke("play_sound", { source, volume, looping }),

  stop: (): Promise<void> => invoke("stop_sound"),

  listBuiltin: (): Promise<string[]> => invoke("list_builtin_sounds"),

  getRecentFiles: (): Promise<RecentAudioFile[]> =>
    invoke("get_recent_audio_files"),

  addRecentFile: (path: string, label: string): Promise<void> =>
    invoke("add_recent_audio_file", { path, label }),
};

// Overlay alert commands
export const overlayService = {
  show: (appName: string, distractedMs: number, isTest = false): Promise<void> =>
    invoke("show_overlay_alert", { appName, distractedMs, isTest }),

  dismiss: (): Promise<void> => invoke("dismiss_overlay_alert"),

  getActive: (): Promise<OverlayAlertPayload | null> =>
    invoke("get_active_overlay_alert"),

  cancelActive: (): Promise<void> => invoke("cancel_active_alerts"),
};

export const notificationService = {
  send: (title: string, body: string): Promise<void> =>
    invoke("send_app_notification", { title, body }),
};

export interface RunningApp {
  name: string;
  exe: string;
  pid: number;
}

// Monitor commands
export const monitorService = {
  getCurrentWindow: (): Promise<WindowInfo | null> =>
    invoke("get_current_window"),

  listRunningApps: (): Promise<RunningApp[]> =>
    invoke("list_running_apps"),

  getIdleTime: (): Promise<number> =>
    invoke("get_idle_time"),

  updateTrayStatus: (label: string): Promise<void> =>
    invoke("update_tray_status", { label }),
};

// Permissions commands
export const permissionsService = {
  check: (): Promise<import("@/types").PermissionsStatus> =>
    invoke("check_permissions"),

  openAccessibilitySettings: (): Promise<void> =>
    invoke("open_accessibility_settings"),
};

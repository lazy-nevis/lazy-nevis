import { invoke } from "@tauri-apps/api/core";
import type {
  AppMode,
  AppSettings,
  AppStatusPayload,
  ActiveSessionRuntime,
  Checkpoint,
  ChecklistItem,
  ChecklistSortMode,
  LiveStats,
  OverlayAlertPayload,
  Session,
  SessionStats,
  SessionSummary,
  ShortcutStatus,
  Tag,
  TrayLabels,
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

  getShortcutRegistrationStatus: (): Promise<ShortcutStatus[]> =>
    invoke("get_shortcut_registration_status"),
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
  send: (title: string, body: string, onlyIfInactive = false): Promise<void> =>
    invoke("send_app_notification", { title, body, onlyIfInactive }),
};

// Daily checklist commands (spec: daily-checklist)
export const checklistService = {
  create: (title: string, tags: string[] = [], dueDate?: number): Promise<ChecklistItem> =>
    invoke("create_checklist_item", { args: { title, due_date: dueDate ?? null, tags } }),

  update: (id: string, title: string, tags: string[] = [], dueDate?: number | null): Promise<ChecklistItem> =>
    invoke("update_checklist_item", { args: { id, title, due_date: dueDate ?? null, tags } }),

  complete: (id: string): Promise<ChecklistItem> =>
    invoke("complete_checklist_item", { id }),

  uncomplete: (id: string): Promise<ChecklistItem> =>
    invoke("uncomplete_checklist_item", { id }),

  delete: (id: string): Promise<void> =>
    invoke("delete_checklist_item", { id }),

  reorder: (ids: string[]): Promise<void> =>
    invoke("reorder_checklist_items", { ids }),

  listOpen: (): Promise<ChecklistItem[]> =>
    invoke("list_open_checklist_items"),

  listHistory: (
    from: number | null,
    to: number | null,
    sort: ChecklistSortMode,
    tags: string[] = [],
  ): Promise<ChecklistItem[]> =>
    invoke("list_checklist_history", { args: { from, to, sort, tags } }),

  listTags: (): Promise<Tag[]> => invoke("list_checklist_tags"),

  linkSession: (itemId: string, sessionId: string): Promise<void> =>
    invoke("link_checklist_session", { itemId, sessionId }),

  getLinkedItem: (sessionId: string): Promise<ChecklistItem | null> =>
    invoke("get_linked_checklist_item", { sessionId }),
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
};

// Tray commands (spec: tray-status)
export const trayService = {
  setLabels: (labels: TrayLabels): Promise<void> =>
    invoke("set_tray_labels", { labels }),
};

// App mode commands (spec: app-modes)
export const appModeService = {
  getStatus: (): Promise<AppStatusPayload> => invoke("get_app_status"),

  setMode: (mode: AppMode): Promise<void> => invoke("set_app_mode", { mode }),

  setPin: (pinned: boolean): Promise<void> => invoke("set_window_pin", { pinned }),

  openSecondary: (pane: "settings" | "history" | "checklist-history" | "about"): Promise<void> =>
    invoke("open_secondary_window", { pane }),
};

// Permissions commands
export const permissionsService = {
  check: (): Promise<import("@/types").PermissionsStatus> =>
    invoke("check_permissions"),

  openAccessibilitySettings: (): Promise<void> =>
    invoke("open_accessibility_settings"),
};

// Screenshot demo (gated; returns DemoInactive when gate is off)
export const demoService = {
  isActive: (): Promise<boolean> => invoke("demo_is_active"),
};

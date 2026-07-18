// Types mirroring Rust backend structs

export interface Session {
  id: string;
  label: string | null;
  started_at: number;
  ended_at: number | null;
  total_focus_ms: number;
  total_distracted_ms: number;
  total_idle_ms: number;
  total_alerts: number;
  notes: string | null;
  settings_snapshot: string;
}

export interface SessionSummary {
  id: string;
  label: string | null;
  started_at: number;
  ended_at: number | null;
  total_focus_ms: number;
  total_distracted_ms: number;
  total_idle_ms: number;
  total_alerts: number;
  focus_percent: number;
}

export type EventType =
  | "app_focus"
  | "app_blur"
  | "title_change"
  | "alert_shown"
  | "alert_dismissed"
  | "session_checkpoint"
  | "break_start"
  | "break_end";

export interface TimelineEvent {
  id: string;
  session_id: string;
  started_at: number;
  ended_at: number | null;
  duration_ms: number | null;
  event_type: EventType;
  app_name: string | null;
  app_exe: string | null;
  window_title: string | null;
  is_browser: boolean;
  is_distraction: boolean;
  alert_type: string | null;
}

export interface Checkpoint {
  id: string;
  session_id: string;
  created_at: number;
  label: string | null;
}

export interface SessionStats {
  session: Session;
  events: TimelineEvent[];
  checkpoints: Checkpoint[];
}

export interface WindowInfo {
  app_name: string;
  app_exe: string;
  window_title: string;
  clean_title: string;
  is_browser: boolean;
  pid: number | null;
}

export interface LiveStats {
  total_ms: number;
  focus_ms: number;
  distracted_ms: number;
  idle_ms: number;
  focus_percent: number;
  alert_count: number;
  is_distracted: boolean;
  is_paused: boolean;
  is_idle: boolean;
  on_break?: boolean;
  current_app: string | null;
}

export interface ActiveSessionRuntime {
  session: Session;
  live_stats: LiveStats;
  checkpoints: Checkpoint[];
}

export type PermissionState = "granted" | "denied" | "notdetermined" | "notrequired";

export interface PermissionsStatus {
  notifications: PermissionState;
  accessibility: PermissionState;
  platform: string;
}

// Settings
export interface GeneralSettings {
  language: string;
  theme: "light" | "dark" | "system";
  polling_interval_ms: number;
  micro_event_threshold_ms: number;
  start_minimized: boolean;
  launch_at_login: boolean;
  time_format: "12h" | "24h";
}

export interface FocusRules {
  mode: "allowlist" | "blocklist";
  apps: string[];
  browser_tab_mode: "allowlist" | "blocklist";
  browser_tab_terms: string[];
  /** User-added processes ignored by focus detection (extends the built-in list). */
  ignored_apps: string[];
}

export interface AlertSettings {
  notification_enabled: boolean;
  notification_threshold_ms: number;
  fullscreen_enabled: boolean;
  fullscreen_threshold_ms: number;
  cooldown_ms: number;
  session_feedback_notifications: boolean;
}

export interface AudioSettings {
  notification_sound: string;
  fullscreen_sound: string;
  volume: number;
  notification_sound_enabled: boolean;
  fullscreen_sound_enabled: boolean;
}

export interface BreakSettings {
  enabled: boolean;
  focus_interval_ms: number;
  break_duration_ms: number;
  alert_type: "notification" | "fullscreen";
}

export interface ShortcutSettings {
  toggle_focus: string;
  stop_session: string;
  open_home: string;
  add_checkpoint: string;
}

export type ShortcutAction = keyof ShortcutSettings;

// Daily checklist (spec: daily-checklist)
export interface Tag {
  id: string;
  name: string;
  created_at: number;
}

export interface ChecklistItem {
  id: string;
  title: string;
  created_at: number;
  completed_at: number | null;
  due_date: number | null;
  sort_order: number;
  tags: Tag[];
}

export type ChecklistSortMode = "created" | "due" | "completed";

export interface ChecklistSettings {
  grace_period_ms: number;
  history_sort: ChecklistSortMode;
}

export interface ChecklistChangedPayload {
  reason: string;
  item_id: string | null;
}

// App modes (spec: app-modes)
export type AppMode = "full" | "compact";

export interface AppStatusPayload {
  mode: AppMode;
  pinned: boolean;
  session_state: "idle" | "running" | "paused";
  session_elapsed_ms: number;
  /** True while the main window is in native OS fullscreen. */
  is_fullscreen: boolean;
}

export interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppModeSettings {
  mode: AppMode;
  pinned: boolean;
  full_geometry: WindowGeometry | null;
  compact_geometry: WindowGeometry | null;
}

// Tray (spec: tray-status)
export interface TrayLabels {
  show: string;
  toggle_focus: string;
  stop_session: string;
  quit: string;
  state_idle: string;
  state_running: string;
  state_paused: string;
  open_quick_panel: string;
}

export interface ShortcutStatus {
  action: string;
  shortcut: string;
  registered: boolean;
  error: string | null;
}

export interface AppSettings {
  general: GeneralSettings;
  focus_rules: FocusRules;
  alerts: AlertSettings;
  audio: AudioSettings;
  breaks: BreakSettings;
  shortcuts: ShortcutSettings;
  checklist: ChecklistSettings;
  app_mode: AppModeSettings;
}

// Event payloads from Rust
export interface SessionLifecyclePayload {
  session_id: string;
  label: string | null;
  elapsed_ms: number;
}

export interface TickPayload {
  session_id: string;
  focus_ms: number;
  distracted_ms: number;
  total_ms: number;
  focus_percent: number;
  alert_count: number;
  is_distracted: boolean;
  is_paused: boolean;
  is_idle: boolean;
  on_break?: boolean;
  idle_ms: number;
  current_app: string | null;
  current_title: string | null;
}

export interface AlertPayload {
  session_id: string;
  app_name: string;
  distracted_ms: number;
  alert_type: "notification" | "fullscreen";
}

export interface OverlayAlertPayload {
  session_id: string;
  app_name: string;
  window_title: string | null;
  distracted_ms: number;
  session_elapsed_ms: number;
  focus_ms: number;
  idle_ms: number;
  alert_started_at_ms: number;
  is_test: boolean;
  language: "en-US" | "pt-BR";
  time_format: "12h" | "24h";
}

export interface WindowChangedPayload {
  app_name: string;
  app_exe: string;
  title: string;
  is_distraction: boolean;
}

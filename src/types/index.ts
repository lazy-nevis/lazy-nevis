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
  week_start: 0 | 1;
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

export interface AlertChannels {
  notification: boolean;
  fullscreen: boolean;
  sound: boolean;
}

export interface DeliverySettings {
  reminders: AlertChannels;
  habits: AlertChannels;
  pomodoro: AlertChannels;
  reminder_sound: string;
  habit_sound: string;
  pomodoro_sound: string;
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

export type ChecklistPriority = "none" | "low" | "medium" | "high" | "urgent";

export interface ChecklistCategory {
  id: string;
  name: string;
  tone: string;
  sort_order: number;
  created_at: number;
}

export interface ChecklistItem {
  id: string;
  title: string;
  created_at: number;
  completed_at: number | null;
  due_date: number | null;
  due_has_time: boolean;
  sort_order: number;
  parent_id: string | null;
  category: ChecklistCategory | null;
  priority: ChecklistPriority;
  tags: Tag[];
}

export type ChecklistSortMode = "created" | "due" | "completed";

export type ChecklistGroupBy = "category" | "date" | "priority";

export interface ChecklistSettings {
  grace_period_ms: number;
  history_sort: ChecklistSortMode;
  group_by: ChecklistGroupBy[];
  /** Category ids (or `__none__`) shown in the open list; empty = all. */
  category_filter: string[];
  date_recognition: boolean;
}

export interface ChecklistChangedPayload {
  reason: string;
  item_id: string | null;
}

export interface CreateChecklistInput {
  title: string;
  tags?: string[];
  dueDate?: number | null;
  dueHasTime?: boolean;
  category?: string | null;
  priority?: ChecklistPriority;
  parentId?: string | null;
}

export interface UpdateChecklistPatch {
  title?: string;
  tags?: string[];
  dueDate?: number | null;
  dueHasTime?: boolean;
  category?: string | null;
  priority?: ChecklistPriority;
}

export type ScheduleRule =
  | { kind: "once"; at: string }
  | { kind: "daily"; times: string[]; weekdays: number[] }
  | {
      kind: "interval";
      every_minutes: number;
      window_start: string;
      window_end: string;
      weekdays: number[];
    }
  | { kind: "monthly"; days: number[]; times: string[] };

export interface Schedule {
  id: string;
  owner_kind: string;
  owner_id: string;
  rule: ScheduleRule;
  starts_on: string | null;
  ends_on: string | null;
  active: boolean;
  created_at: number;
}

export interface ScheduleInput {
  id?: string | null;
  rule: ScheduleRule;
  starts_on?: string | null;
  ends_on?: string | null;
  active: boolean;
}

export interface Reminder {
  id: string;
  title: string;
  body_md: string | null;
  tone: string;
  channels: AlertChannels | null;
  sound: string | null;
  active: boolean;
  finished_at: number | null;
  created_at: number;
  updated_at: number;
  schedules: Schedule[];
  next_occurrence: number | null;
}

export interface ReminderInput {
  title: string;
  body_md?: string | null;
  tone: string;
  channels?: AlertChannels | null;
  sound?: string | null;
  active: boolean;
  schedules: ScheduleInput[];
}

export interface TriggerEvent {
  id: string;
  owner_kind: string;
  owner_id: string;
  schedule_id: string | null;
  scheduled_for: number;
  delivered_at: number | null;
  channels: string | null;
  status: string;
  late: boolean;
  acted_at: number | null;
  created_at: number;
  reminder_title: string | null;
}

export type OverlayKind = "distraction" | "reminder" | "habit" | "pomodoro";

export interface ReminderOverlay {
  event_id: string;
  owner_kind: string;
  owner_id: string;
  title: string;
  body_md: string | null;
  tone: string;
  late: boolean;
  actions: string[];
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

// Habits (spec: habit-tracking)
export type HabitPeriod = "daily" | "weekly" | "monthly";
export type HabitMetric = "check" | "count" | "volume" | "mass" | "distance" | "duration";
export type HabitPeriodStatus = "met" | "partial" | "missed" | "pending" | "inactive";
export type HabitLogSource =
  | "card"
  | "dialog"
  | "quick_log"
  | "overlay"
  | "compact"
  | "tray";

export interface HabitTarget {
  id: string;
  habit_id: string;
  metric: string;
  unit: string;
  target_value: number;
  sort_order: number;
  archived_at: number | null;
}

export interface Habit {
  id: string;
  name: string;
  description: string | null;
  tone: string;
  icon: string;
  period: HabitPeriod;
  active: boolean;
  skip_reminders_when_met: boolean;
  channels: AlertChannels | null;
  sound: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
  targets: HabitTarget[];
  schedules: Schedule[];
}

export interface HabitTargetInput {
  id?: string | null;
  metric: string;
  unit: string;
  target_value: number;
}

export interface HabitInput {
  name: string;
  description?: string | null;
  tone: string;
  icon: string;
  period: HabitPeriod;
  active: boolean;
  skip_reminders_when_met: boolean;
  channels?: AlertChannels | null;
  sound?: string | null;
  targets: HabitTargetInput[];
  schedules: ScheduleInput[];
}

export interface HabitTargetProgress {
  target_id: string;
  metric: string;
  unit: string;
  target_value: number;
  progress: number;
}

export interface HabitProgress {
  period_start: number;
  period_end: number;
  per_target: HabitTargetProgress[];
  status: HabitPeriodStatus;
  percent: number;
}

export interface HabitTodayCard {
  habit: Habit;
  progress: HabitProgress;
  streak_current: number;
}

export interface HabitTodaySummary {
  met_count: number;
  total_active: number;
  cards: HabitTodayCard[];
}

export interface HabitLogValueInput {
  target_id: string;
  value: number;
}

export interface HabitLogInput {
  values: HabitLogValueInput[];
  note?: string | null;
  logged_at: number;
  source: HabitLogSource;
  trigger_event_id?: string | null;
}

export interface HabitLogValue {
  target_id: string;
  value: number;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  logged_at: number;
  note: string | null;
  source: string;
  trigger_event_id: string | null;
  created_at: number;
  updated_at: number;
  values: HabitLogValue[];
}

export interface HabitPeriodHistoryEntry {
  period_start: number;
  period_end: number;
  status: HabitPeriodStatus;
  per_target: HabitTargetProgress[];
  percent: number;
}

export interface HabitDayPoint {
  date: string;
  value: number;
}

export interface HabitStats {
  streak_current: number;
  streak_best: number;
  completion_rate_7: number;
  completion_rate_30: number;
  completion_rate_90: number;
  totals_per_target: HabitTargetProgress[];
  average_per_logged_day: number;
}

export interface HabitDetail {
  habit: Habit;
  progress: HabitProgress;
  stats: HabitStats;
  period_history: HabitPeriodHistoryEntry[];
  logs: HabitLog[];
}

export interface HabitReportRow {
  habit_id: string;
  habit_name: string;
  completion_rate: number;
  met_count: number;
  missed_count: number;
  log_count: number;
}

export interface HabitReports {
  from_ms: number;
  to_ms: number;
  rows: HabitReportRow[];
  best_habit_id: string | null;
  worst_habit_id: string | null;
  weekday_distribution: number[];
}

export interface HabitExportRow {
  habit_id: string;
  habit_name: string;
  target_id: string;
  metric: string;
  unit: string;
  value: number;
  logged_at: string;
  note: string | null;
  source: string;
}

export interface HabitExport {
  habits: Habit[];
  logs: HabitExportRow[];
}

export interface QuickLogOpenPayload {
  habit_id: string;
  event_id: string | null;
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

export type PomodoroPhaseKind = "focus" | "short_break" | "long_break";
export type PomodoroRunState = "running" | "paused" | "awaiting";
export type PomodoroPhaseOutcome = "completed" | "skipped" | "cancelled";
export type PomodoroRunOutcome = "completed" | "cancelled";

export interface PomodoroSettings {
  enabled: boolean;
  focus_ms: number;
  short_break_ms: number;
  long_break_ms: number;
  long_break_every: number;
  auto_start_breaks: boolean;
  auto_start_focus: boolean;
  link_focus_session: boolean;
  stop_session_with_run: boolean;
  daily_goal: number;
}

export interface PomodoroPhase {
  id: string;
  run_id: string;
  seq: number;
  kind: PomodoroPhaseKind;
  planned_ms: number;
  elapsed_ms: number;
  pauses: number;
  started_at: number;
  ended_at: number | null;
  outcome: PomodoroPhaseOutcome | null;
}

export interface PomodoroRun {
  id: string;
  label: string | null;
  checklist_item_id: string | null;
  session_id: string | null;
  session_owned: boolean;
  started_at: number;
  ended_at: number | null;
  outcome: PomodoroRunOutcome | null;
}

export interface PomodoroState {
  run: PomodoroRun | null;
  phase: PomodoroPhase | null;
  remaining_ms: number;
  elapsed_ms: number;
  state: PomodoroRunState;
  focus_completed_in_set: number;
  long_break_every: number;
  today_completed: number;
  daily_goal: number;
}

export interface PomodoroPhaseListItem {
  phase: PomodoroPhase;
  run_label: string | null;
  checklist_item_id: string | null;
}

export interface PomodoroExport {
  runs: PomodoroRun[];
  phases: PomodoroPhaseListItem[];
}

export interface PomodoroDayStat {
  /** Local date, `YYYY-MM-DD`. */
  day: string;
  focus_phases: number;
  focus_ms: number;
}

export interface PomodoroStats {
  focus_phases_completed: number;
  focus_phases_started: number;
  focus_ms: number;
  breaks_taken: number;
  pauses: number;
  skips: number;
  cancels: number;
  interruptions: number;
  /** 0–1 */
  completion_rate: number;
  avg_pauses_per_focus: number;
  best_hour: number | null;
  hour_histogram: number[];
  per_day: PomodoroDayStat[];
}

export interface ShortcutStatus {
  action: string;
  shortcut: string;
  registered: boolean;
  error: string | null;
}

export interface UiSettings {
  sidebar_collapsed: boolean;
}

export interface AppSettings {
  general: GeneralSettings;
  ui: UiSettings;
  focus_rules: FocusRules;
  alerts: AlertSettings;
  delivery: DeliverySettings;
  audio: AudioSettings;
  breaks: BreakSettings;
  shortcuts: ShortcutSettings;
  pomodoro: PomodoroSettings;
  checklist: ChecklistSettings;
  calendar: CalendarSettings;
  app_mode: AppModeSettings;
}

export type CalendarView = "month" | "week" | "day";

export type CalendarKind =
  | "session"
  | "pomodoro_run"
  | "checklist_completed"
  | "checklist_due"
  | "habit_log"
  | "habit_day"
  | "reminder_occurrence";

export interface CalendarSettings {
  visible_kinds: CalendarKind[];
  default_view: CalendarView;
}

export interface CalendarDayCounts {
  session: number;
  pomodoro_run: number;
  checklist_completed: number;
  checklist_due: number;
  habit_log: number;
  habit_day: number;
  reminder_occurrence: number;
}

export interface CalendarDay {
  date: string;
  counts: CalendarDayCounts;
  habits_met: number;
  habits_due: number;
}

export type CalendarEntry =
  | {
      kind: "session";
      id: string;
      session_id: string;
      label: string | null;
      segment_start_ms: number;
      segment_end_ms: number;
      focus_percent: number;
      total_focus_ms: number;
      total_distracted_ms: number;
    }
  | {
      kind: "pomodoro_run";
      id: string;
      run_id: string;
      label: string | null;
      segment_start_ms: number;
      segment_end_ms: number;
      cycles_completed: number;
      focus_ms: number;
      status: "active" | "completed" | "cancelled";
    }
  | {
      kind: "checklist_completed";
      id: string;
      item_id: string;
      title: string;
      completed_at: number;
      due_date: number | null;
      due_has_time: boolean;
      late: boolean;
      tone: string | null;
    }
  | {
      kind: "checklist_due";
      id: string;
      item_id: string;
      title: string;
      due_date: number;
      due_has_time: boolean;
      completed_at: number | null;
      overdue: boolean;
      tone: string | null;
    }
  | {
      kind: "habit_log";
      id: string;
      habit_id: string;
      habit_name: string;
      logged_at: number;
      tone: string;
      note: string | null;
    }
  | {
      kind: "habit_day";
      id: string;
      habit_id: string;
      habit_name: string;
      date: string;
      status: string;
      tone: string;
      logs_count: number;
    }
  | {
      kind: "reminder_occurrence";
      id: string;
      reminder_id: string;
      schedule_id: string | null;
      title: string;
      tone: string;
      scheduled_for: number;
      status: string;
      late: boolean;
      event_id: string | null;
    };

export interface CalendarRange {
  from_ms: number;
  to_ms: number;
  days: CalendarDay[];
  entries: CalendarEntry[];
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
  kind?: OverlayKind;
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
  reminder?: ReminderOverlay | null;
}

export interface WindowChangedPayload {
  app_name: string;
  app_exe: string;
  title: string;
  is_distraction: boolean;
}

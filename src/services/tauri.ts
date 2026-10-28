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
  Reminder,
  ReminderInput,
  ScheduleRule,
  TriggerEvent,
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

  resolveAction: (
    eventId: string | null,
    action: string,
    snoozeMinutes?: number,
  ): Promise<void> =>
    invoke("resolve_overlay_action", {
      eventId,
      action,
      snoozeMinutes: snoozeMinutes ?? null,
    }),
};

export const reminderService = {
  list: (): Promise<Reminder[]> => invoke("list_reminders"),
  get: (id: string): Promise<Reminder> => invoke("get_reminder", { id }),
  create: (input: ReminderInput): Promise<Reminder> =>
    invoke("create_reminder", { input }),
  update: (id: string, input: ReminderInput): Promise<Reminder> =>
    invoke("update_reminder", { id, input }),
  delete: (id: string): Promise<void> => invoke("delete_reminder", { id }),
  setActive: (id: string, active: boolean): Promise<Reminder> =>
    invoke("set_reminder_active", { id, active }),
  previewSchedule: (
    rule: ScheduleRule,
    startsOn: string | null,
    endsOn: string | null,
    count?: number,
  ): Promise<number[]> =>
    invoke("preview_schedule", {
      rule,
      startsOn,
      endsOn,
      count: count ?? null,
    }),
  listEvents: (
    limit?: number,
    ownerKind?: string,
    ownerId?: string,
  ): Promise<TriggerEvent[]> =>
    invoke("list_trigger_events", {
      limit: limit ?? null,
      ownerKind: ownerKind ?? null,
      ownerId: ownerId ?? null,
    }),
  actOnEvent: (
    eventId: string,
    action: string,
    snoozeMinutes?: number,
  ): Promise<void> =>
    invoke("act_on_trigger_event", {
      eventId,
      action,
      snoozeMinutes: snoozeMinutes ?? null,
    }),
};

export const deliveryService = {
  test: (kind: "reminder" | "habit" | "pomodoro"): Promise<void> =>
    invoke("test_delivery", { kind }),
};

export const notificationService = {
  send: (title: string, body: string, onlyIfInactive = false): Promise<void> =>
    invoke("send_app_notification", { title, body, onlyIfInactive }),
};

// Daily checklist commands (spec: daily-checklist)
export const checklistService = {
  create: (input: import("@/types").CreateChecklistInput): Promise<ChecklistItem> =>
    invoke("create_checklist_item", {
      args: {
        title: input.title,
        due_date: input.dueDate ?? null,
        due_has_time: input.dueHasTime ?? false,
        tags: input.tags ?? [],
        category: input.category ?? null,
        priority: input.priority && input.priority !== "none" ? input.priority : null,
        parent_id: input.parentId ?? null,
      },
    }),

  update: (id: string, patch: import("@/types").UpdateChecklistPatch & { title: string; tags: string[] }): Promise<ChecklistItem> =>
    invoke("update_checklist_item", {
      args: {
        id,
        title: patch.title,
        due_date: patch.dueDate === undefined ? null : patch.dueDate,
        due_has_time: patch.dueHasTime ?? false,
        tags: patch.tags,
        category: patch.category ?? null,
        priority: patch.priority && patch.priority !== "none" ? patch.priority : null,
      },
    }),

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
    categories: string[] = [],
  ): Promise<ChecklistItem[]> =>
    invoke("list_checklist_history", { args: { from, to, sort, tags, categories } }),

  listTags: (): Promise<Tag[]> => invoke("list_checklist_tags"),

  listCategories: (): Promise<import("@/types").ChecklistCategory[]> =>
    invoke("list_checklist_categories"),

  createCategory: (name: string, tone?: string): Promise<import("@/types").ChecklistCategory> =>
    invoke("create_checklist_category", { args: { name, tone: tone ?? null } }),

  updateCategory: (id: string, name: string, tone: string): Promise<import("@/types").ChecklistCategory> =>
    invoke("update_checklist_category", { args: { id, name, tone } }),

  deleteCategory: (id: string): Promise<void> =>
    invoke("delete_checklist_category", { id }),

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

export const habitService = {
  list: (includeInactive = false): Promise<import("@/types").Habit[]> =>
    invoke("list_habits", { includeInactive }),
  getDetail: (id: string): Promise<import("@/types").HabitDetail> =>
    invoke("get_habit_detail", { id }),
  create: (input: import("@/types").HabitInput): Promise<import("@/types").Habit> =>
    invoke("create_habit", { input }),
  update: (id: string, input: import("@/types").HabitInput): Promise<import("@/types").Habit> =>
    invoke("update_habit", { id, input }),
  delete: (id: string): Promise<void> => invoke("delete_habit", { id }),
  setActive: (id: string, active: boolean): Promise<import("@/types").Habit> =>
    invoke("set_habit_active", { id, active }),
  reorder: (orderedIds: string[]): Promise<void> =>
    invoke("reorder_habits", { orderedIds }),
  log: (habitId: string, input: import("@/types").HabitLogInput): Promise<import("@/types").HabitLog> =>
    invoke("log_habit", { habitId, input }),
  updateLog: (
    logId: string,
    input: import("@/types").HabitLogInput,
  ): Promise<import("@/types").HabitLog> => invoke("update_habit_log", { logId, input }),
  deleteLog: (logId: string): Promise<void> => invoke("delete_habit_log", { logId }),
  listLogs: (habitId: string, fromMs: number, toMs: number): Promise<import("@/types").HabitLog[]> =>
    invoke("list_habit_logs", { habitId, fromMs, toMs }),
  getToday: (): Promise<import("@/types").HabitTodaySummary> => invoke("get_habits_today"),
  daySeries: (
    habitId: string | null,
    fromMs: number,
    toMs: number,
  ): Promise<import("@/types").HabitDayPoint[]> =>
    invoke("get_habit_day_series", { habitId, fromMs, toMs }),
  reports: (fromMs: number, toMs: number): Promise<import("@/types").HabitReports> =>
    invoke("get_habit_reports", { fromMs, toMs }),
  export: (habitId?: string | null): Promise<import("@/types").HabitExport> =>
    invoke("export_habits", { habitId: habitId ?? null }),
  openQuickLog: (habitId: string, eventId?: string | null): Promise<void> =>
    invoke("open_quick_log", { habitId, eventId: eventId ?? null }),
  takeQuickLogRequest: (): Promise<import("@/types").QuickLogOpenPayload | null> =>
    invoke("take_quick_log_request"),
};

// Tray commands (spec: tray-status)
export const trayService = {
  setLabels: (labels: TrayLabels): Promise<void> =>
    invoke("set_tray_labels", { labels }),
};

export const pomodoroService = {
  getState: (): Promise<import("@/types").PomodoroState> => invoke("get_pomodoro_state"),
  start: (args: {
    label?: string | null;
    checklist_item_id?: string | null;
  }): Promise<import("@/types").PomodoroState> => invoke("start_pomodoro", { args }),
  pause: (): Promise<import("@/types").PomodoroState> => invoke("pause_pomodoro"),
  resume: (): Promise<import("@/types").PomodoroState> => invoke("resume_pomodoro"),
  skipPhase: (): Promise<import("@/types").PomodoroState> => invoke("skip_pomodoro_phase"),
  startNext: (): Promise<import("@/types").PomodoroState> =>
    invoke("start_next_pomodoro_phase"),
  stop: (): Promise<import("@/types").PomodoroState> => invoke("stop_pomodoro"),
  listRuns: (from: number, to: number): Promise<import("@/types").PomodoroRun[]> =>
    invoke("list_pomodoro_runs", { from, to }),
  listPhases: (from: number, to: number): Promise<import("@/types").PomodoroPhaseListItem[]> =>
    invoke("list_pomodoro_phases", { from, to }),
  stats: (from: number, to: number): Promise<import("@/types").PomodoroStats> =>
    invoke("get_pomodoro_stats", { from, to }),
  deleteRun: (runId: string): Promise<void> => invoke("delete_pomodoro_run", { runId }),
  export: (from: number, to: number): Promise<import("@/types").PomodoroExport> =>
    invoke("export_pomodoro", { from, to }),
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

export const calendarService = {
  getRange: (
    fromMs: number,
    toMs: number,
    kinds?: import("@/types").CalendarKind[],
  ): Promise<import("@/types").CalendarRange> =>
    invoke("get_calendar_range", { fromMs, toMs, kinds: kinds ?? null }),
};

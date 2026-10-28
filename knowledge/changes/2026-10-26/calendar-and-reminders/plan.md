---
type: concept
title: calendar-and-reminders — plan
description: Technical plan for the scheduler ticker, delivery service, overlay generalization, reminders, and calendar aggregation.
tags: [change, plan, reminders, calendar, scheduler]
---

# Plan — calendar-and-reminders

Phase A = lane **L3**, wave 1. Phase B = lane **L2**, wave 3. Shared files: follow
[`coordination.md`](../app-visual-identity/coordination.md).

## Current code (observed)

- `src-tauri/src/monitor.rs`: per-session 1 s ticker (`start_monitor`) — pause/break handling,
  alert thresholds (`select_alert_channel`), break reminders, `session:tick`. Only runs while a
  session exists.
- `src-tauri/src/commands/monitor.rs`: overlay window lifecycle — `ensure_overlay_window`,
  `position_overlay_on_active_monitor`, `build_overlay_payload` (session-specific),
  `show_overlay_payload` (main-thread hop + `active_overlay` + Esc global shortcut +
  `overlay:show` emit), `cancel_active_alerts_inner(app, state, record_dismiss, alert_type)`
  (hides overlay, stops audio, resets session distraction timers, logs `AlertDismissed`),
  commands `show_overlay_alert`, `get_active_overlay_alert`, `dismiss_overlay_alert`,
  `cancel_active_alerts`, `hide_overlay_alert`.
- `src-tauri/src/models/overlay.rs`: `OverlayAlertPayload { session_id, app_name, window_title,
  distracted_ms, session_elapsed_ms, focus_ms, idle_ms, alert_started_at_ms, is_test, language,
  time_format }`.
- `src-tauri/src/services/notifications.rs`: `notify(app, title, body, NotificationPolicy)`;
  `Always` policy exists.
- `src-tauri/src/services/audio_player.rs`: `AudioPlayer::play(path, volume, looping)`, `stop()`;
  `resolve_sound_path(sound, resource_dir)` (line ~135) for `builtin:` ids and custom files.
- Frontend alert flow: `useFocusSession` listens to `alert:show` / `alert:fullscreen` and plays
  sounds via `audioService` (frontend-driven). Reminders/habits/pomodoro must work while the
  webview may be hidden → **delivery is Rust-driven** (sound played from Rust via `AudioPlayer`).
- `src/pages/Overlay.tsx`: distraction overlay UI, listens `overlay:show`/`overlay:hide`,
  hydrates with `overlayService.getActive()`, Esc dismiss.
- `AppState` (`state.rs`): `active_overlay: Mutex<Option<OverlayAlertPayload>>`, `audio`,
  `settings`, `db`, `checklist`, `app_status`.
- Settings: `AlertSettings`, `AudioSettings { notification_sound, fullscreen_sound, volume, … }`.
- `chrono` is a dependency (serde feature). No tz database crate.

## Phase A design (L3)

### Migration `0006_reminders_scheduler.sql`

```sql
CREATE TABLE reminders (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body_md TEXT,
    tone TEXT NOT NULL DEFAULT 'sky',
    channels_json TEXT,            -- NULL = inherit delivery.reminders
    sound TEXT,                    -- NULL = inherit
    active INTEGER NOT NULL DEFAULT 1,
    finished_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE TABLE schedules (
    id TEXT PRIMARY KEY,
    owner_kind TEXT NOT NULL CHECK (owner_kind IN ('reminder','habit')),
    owner_id TEXT NOT NULL,
    rule_json TEXT NOT NULL,
    starts_on TEXT,                -- 'YYYY-MM-DD' local
    ends_on TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
);
CREATE INDEX idx_schedules_owner ON schedules(owner_kind, owner_id);
CREATE TABLE trigger_snoozes (
    id TEXT PRIMARY KEY,
    owner_kind TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    fire_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (owner_kind, owner_id)
);
CREATE TABLE trigger_events (
    id TEXT PRIMARY KEY,
    owner_kind TEXT NOT NULL,      -- 'reminder' | 'habit' | 'pomodoro'
    owner_id TEXT NOT NULL,
    schedule_id TEXT,              -- NULL for snooze/pomodoro
    scheduled_for INTEGER NOT NULL,
    delivered_at INTEGER,
    channels TEXT,                 -- e.g. 'notification,sound'
    status TEXT NOT NULL CHECK (status IN ('delivered','done','snoozed','dismissed','missed','logged','skipped')),
    late INTEGER NOT NULL DEFAULT 0,
    acted_at INTEGER,
    created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_trigger_events_dedupe ON trigger_events(owner_kind, owner_id, IFNULL(schedule_id,''), scheduled_for);
CREATE INDEX idx_trigger_events_time ON trigger_events(scheduled_for);
```

(If `IFNULL` in a unique index is rejected by the bundled SQLite version, use
`COALESCE(schedule_id,'')` — expressions in indexes are supported since 3.9; verify in a test.)

Polymorphic owners have no FK: owner services delete their schedules/snoozes/events in the same
transaction when deleting the owner.

### Rust modules

- `models/schedule.rs`: `ScheduleRule` (serde `tag = "kind"`, `rename_all = "snake_case"`):
  `Once { at: String /*YYYY-MM-DDTHH:MM local*/ }`, `Daily { times: Vec<String>, weekdays: Vec<u8> }`,
  `Interval { every_minutes: u32, window_start: String, window_end: String, weekdays: Vec<u8> }`,
  `Monthly { days: Vec<u8>, times: Vec<String> }`; `Schedule { id, owner_kind, owner_id, rule,
  starts_on: Option<String>, ends_on: Option<String>, active, created_at }`; `OwnerKind`
  (`Reminder`, `Habit`, `Pomodoro` — pomodoro only for events); `ScheduleRule::validate()`.
- `models/settings.rs`: `AlertChannels { notification: bool, fullscreen: bool, sound: bool }`
  (validate: at least one true), `DeliverySettings { reminders: AlertChannels, habits:
  AlertChannels, pomodoro: AlertChannels, reminder_sound: String, habit_sound: String,
  pomodoro_sound: String }` with defaults from the spec (sounds default `builtin:alert1.wav`);
  `GeneralSettings.week_start: u8` (`#[serde(default = "default_week_start")]` → 1; validate 0|1).
- `models/reminder.rs`: `Reminder { id, title, body_md, tone, channels: Option<AlertChannels>,
  sound: Option<String>, active, finished_at, created_at, updated_at, schedules: Vec<Schedule>,
  next_occurrence: Option<i64> }`, `TriggerEvent { … }`.
- `services/schedule.rs` (pure, no DB): `occurrences_between<Tz: TimeZone>(rule, bounds, from_excl,
  to_incl, tz) -> Vec<i64>` (cap 5 000), `next_after(…) -> Option<i64>`, local-time helpers
  that resolve nonexistent/ambiguous local times per spec. Tests with `chrono::FixedOffset` plus
  DST tests using `chrono-tz` as a **dev-dependency** (`America/Sao_Paulo` historical DST,
  `America/New_York`).
- `services/delivery.rs`: `DeliveryContent { kind: OwnerKind, owner_id, event_id: Option<String>,
  title, body_md: Option<String>, tone, late: bool, actions: Vec<OverlayAction> }`,
  `resolve_channels(type_default, override) -> AlertChannels`, `deliver(app, channels, sound,
  content) -> Result<DeliveryOutcome>`:
  - notification → `notifications::notify(app, title, plain_text(body_md) truncated, Always)`.
  - sound → `AudioPlayer::play(resolve_sound_path(sound), volume, looping = channels.fullscreen)`.
  - fullscreen → `overlay_queue::enqueue_or_show(app, payload)`.
  - pure helper `plain_text(md)` strips Markdown markup for notifications.
- `services/overlay_queue.rs`: `OverlayQueue` (VecDeque, max 5) in `AppState.overlay_queue:
  Mutex<OverlayQueue>`; pure decision fn `decide(current: Option<&OverlayAlertPayload>,
  incoming) -> QueueDecision { ShowNow, Enqueue, FallbackToNotification, PreemptAndRequeue }`
  (unit-tested); `on_overlay_closed(app)` shows the next queued payload.
- `services/reminders.rs`: CRUD (validates title/body/tone/schedules ≤ 20 per owner), list with
  `next_occurrence`, activity listing, `mark_event(event_id, status)`, `snooze(owner, minutes)`,
  finish detection for one-offs. `content_for(owner_id) -> Option<(DeliveryContent,
  AlertChannels, sound)>` (merges inherit/custom with `DeliverySettings`).
- `services/scheduler.rs`: `Scheduler { db, next_due: Option<i64>, dirty: bool, last_check: i64 }`
  in `AppState.scheduler: Arc<Mutex<Scheduler>>`; `mark_dirty()` called by any service that
  changes schedules/owners/snoozes; `tick(now) -> Vec<DueTrigger>` implementing the missed
  policy; `resolve(trigger) -> Option<…>` dispatches by owner kind: `Reminder` →
  `ReminderService::content_for`; `Habit` → returns `None` (wired by habit-tracking);
  records `trigger_events` with dedupe (`INSERT OR IGNORE`; skip delivery when ignored).
- `monitor.rs`: `pub fn start_scheduler_ticker(app: AppHandle)` — tokio 1 s interval spawned once
  in `lib.rs` setup after state is managed; each tick: lock scheduler, `tick(now)`, release lock,
  deliver each due trigger (never hold the scheduler/DB lock while delivering), emit
  `reminders:fired` with the event summary. Recompute `next_due` when dirty or every 60 s.
- Overlay generalization (`models/overlay.rs` + `commands/monitor.rs`): add
  `#[serde(default = "distraction")] kind: String` (`"distraction" | "reminder" | "habit" |
  "pomodoro"`) and `reminder: Option<ReminderOverlay { event_id, owner_kind, owner_id, title,
  body_md, tone, late, actions: Vec<String> }>`; `build_overlay_payload` sets
  `kind = "distraction"`. `cancel_active_alerts_inner` only touches session distraction state
  and logs `AlertDismissed` when the active payload kind is `distraction`; after hiding it calls
  `overlay_queue::on_overlay_closed`. New command `resolve_overlay_action(event_id: Option<String>,
  action: String /*done|dismiss|snooze|log|start_next|skip*/, snooze_minutes: Option<u32>)` →
  routes to reminder/habit/pomodoro handlers (habit/pomodoro arms return
  `AppError::InvalidArgument` until their lanes wire them), stops audio, hides, shows next.
  Esc global shortcut on a non-distraction overlay = `dismiss`.
- Commands `commands/reminders.rs`: `list_reminders`, `get_reminder`, `create_reminder`,
  `update_reminder`, `delete_reminder`, `set_reminder_active`, `preview_schedule(rule, starts_on,
  ends_on, count) -> Vec<i64>`, `list_trigger_events(limit, owner_kind?, owner_id?)`,
  `act_on_trigger_event(event_id, action, snooze_minutes?)`, `test_delivery(kind)` (delivers a
  sample with the configured channels for that alert type). All mutating commands emit
  `reminders:changed` and mark the scheduler dirty.
- `state.rs`: add `reminders: Arc<ReminderService>`, `scheduler: Arc<Mutex<Scheduler>>`,
  `overlay_queue: Mutex<OverlayQueue>`; construct in `lib.rs` `app.manage(AppState { … })`.
- `capabilities/overlay.json`: no new permissions needed (commands are app commands).

### Frontend (L3)

- Types (anchor before `export type AppMode =`): `ScheduleRule` union, `Schedule`,
  `AlertChannels`, `DeliverySettings`, `Reminder`, `ReminderInput`, `TriggerEvent`,
  `ReminderOverlay`, `OverlayKind`; extend `OverlayAlertPayload` with `kind`, `reminder`;
  `GeneralSettings.week_start`; `AppSettings.delivery`; defaults in `settingsStore`.
- Services: `reminderService`, `deliveryService.test(kind)`, `overlayService.resolveAction(…)`.
- `src/utils/schedule.ts`: `describeSchedule(rule, t, locale, weekStart)`, `formatRelativeNext`,
  `emptyRule(kind)`, weekday ordering by `week_start`. Tests in both languages.
- Components `src/components/features/reminders/`: `RemindersPage.tsx` (exported `Reminders`
  page component), `ReminderList.tsx`, `ReminderEditorDialog.tsx`, `ScheduleEditor.tsx`
  (per-kind forms, weekday toggle group, time chips), `MarkdownView.tsx` (uses
  `react-markdown` without raw HTML; links rendered as plain text spans), `ActivityList.tsx`.
- `src/components/features/delivery/`: `ChannelPicker.tsx` (inherit/custom + 3 toggles + sound
  select + Test), `DeliverySettingsTab.tsx` (exported; orchestrator registers it as a Settings
  tab "Notifications & reminders").
- `src/pages/Overlay.tsx`: branch on `kind`: existing distraction UI unchanged; new
  `ReminderOverlayView` (calm design, tone tint via `toneStyle`, clock, title, Markdown body,
  late badge, Done / Snooze menu / kind actions) calling `overlayService.resolveAction`.
- New dependency: `react-markdown` (pin current major). No `rehype-raw`.
- i18n namespaces `reminders`, `schedule`, `delivery`.

## Phase B design (L2, wave 3)

- `services/calendar.rs`: `CalendarService::range(from_ms, to_ms, kinds, tz) ->
  CalendarRange { days: Vec<CalendarDay { date: "YYYY-MM-DD", counts per kind, habits_met,
  habits_due }>, entries: Vec<CalendarEntry> }` with `CalendarEntry` serde-tagged by `kind`:
  `session`, `pomodoro_run`, `checklist_completed`, `checklist_due`, `habit_log`, `habit_day`,
  `reminder_occurrence`. Queries in `queries.rs` per source (sessions by `started_at`/`ended_at`
  overlap; checklist by `completed_at`/`due_date`; habit logs; pomodoro runs; trigger events).
  Reminder/habit-reminder expected occurrences via `services::schedule::occurrences_between`
  (cap 96/owner/day). Habit day status via the habits service's period evaluation (reuse its
  public fn; do not duplicate the logic).
- Command `get_calendar_range(from, to, kinds)` (range ≤ 62 days → `InvalidArgument`).
- Optional migration `0009_calendar_indexes.sql` only if query plans need indexes
  (`sessions(ended_at)`, `checklist_items(completed_at)` exists, `habit_logs(logged_at)` exists).
- Settings: `CalendarSettings { visible_kinds: Vec<String>, default_view: String }` (anchor:
  struct before `ShortcutSettings`? — use: immediately before `#[derive(Debug, Clone, Copy,
  Serialize, Deserialize, PartialEq, Eq)]\npub struct WindowGeometry`, after L1's `UiSettings`;
  field after `pub checklist: ChecklistSettings,`).
- Frontend `src/components/features/calendar/`: `CalendarPage.tsx` (exported `Calendar`),
  `MonthGrid.tsx`, `WeekGrid.tsx`, `DayAgenda.tsx`, `DayPanel.tsx`, `KindFilter.tsx`,
  `calendarMath.ts` (grid days by week start, clipping across midnight) + tests; `History` page
  gains `?session=<id>` deep link to open that session's detail (small, local change in
  `src/pages/History.tsx`).
- "New reminder on this day" reuses `ReminderEditorDialog` with an `initialRule` prop.

## Deviations (phase B)

- ~~`habit_entries` and `pomodoro_entries` are intentional stubs~~ — resolved: L4 wired `habit_entries`; the orchestrator QA implemented `pomodoro_entries` (`SELECT_POMODORO_RUNS_FOR_CALENDAR`: runs overlapping the range with completed focus cycles, focus ms, status `active`/`completed`/`cancelled`; open runs end at their last phase end). `CalendarEntry::PomodoroRun` gained `label`; Day panel shows label, time span, cycles, focus time, status; week/day blocks use the run label.
- Month markers use tone dots rather than mini bars.
- No migration `0009` (existing indexes on `sessions`, `checklist_items.completed_at`, `trigger_events` suffice for initial queries).
- Session overlap query uses `COALESCE(ended_at, range_end)` rather than live runtime heartbeat for open sessions.
- `CalendarSettings` panel lives on the calendar page (orchestrator may also surface in Settings).

## Deviations (phase A)

- ~~Distraction `show_overlay_payload` bypasses the queue~~ — resolved: `show_overlay_payload` now always goes through `enqueue_or_show_overlay` (`OverlayQueue::admit`) when `AppState` exists.
- QA (orchestrator): `create`/`update` held the DB transaction while calling `self.get`, and `delete`/`set_active`/`snooze`/`finalize_if_no_next_occurrence` called `mark_dirty` under the DB guard → deadlocks. Guards scoped/dropped first; rule in `knowledge/rules/rust-locking.md`. Snooze lookup SQL moved to `SELECT_NEXT_TRIGGER_SNOOZE_AFTER`; `next_occurrence_picks_earliest` was missing `#[test]`.
- `finish_overlay_resolution` calls `cancel_active_alerts_inner` then `on_overlay_closed` (acceptable for reminders; distraction cancel also calls `on_overlay_closed` when kind is distraction).
- A15: `alerts-and-cooldown.md` and `settings-persistence.md` not fully expanded in this lane (capability index + rule + CHANGELOG updated); orchestrator may extend those docs in integration.

## Risks

- Ticker + session monitor both touching audio/overlay → all overlay changes go through the queue
  module; distraction path keeps priority.
- Holding locks across `deliver` (notification is async) → collect due triggers, drop locks,
  then deliver.
- `react-markdown` size → lazy-load inside overlay and editor preview.
- Clock/timezone: production uses `chrono::Local`; tests inject tz.
- Wave-1 concurrency: L3 is the only lane touching `state.rs`, `lib.rs` setup, `monitor.rs`,
  `commands/monitor.rs`, `Overlay.tsx` in wave 1.

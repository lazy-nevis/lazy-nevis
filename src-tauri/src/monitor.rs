use crate::error::Result;
use crate::models::settings::{AppSettings, FocusRules};
use crate::models::{focus_percent, EventType};
use crate::services::idle_monitor::get_idle_time_ms;
use crate::services::rule_engine::RuleEngine;
use crate::services::session_logger::SessionLogger;
use crate::services::window_monitor::{monitor_loop, WindowChangeEvent};
use crate::state::{now_ms, AppState, SessionData};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;
use tokio::time;

const SUSPENDED_TICK_THRESHOLD_MS: i64 = 10_000;

fn ticker_was_suspended(elapsed_ms: i64) -> bool {
    elapsed_ms > SUSPENDED_TICK_THRESHOLD_MS
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AlertChannel {
    Notification,
    Fullscreen,
}

fn select_alert_channel(
    alerts: &crate::models::settings::AlertSettings,
    distracted_for: i64,
    cooldown_ok: bool,
) -> Option<AlertChannel> {
    if !cooldown_ok {
        return None;
    }
    if alerts.fullscreen_enabled && distracted_for >= alerts.fullscreen_threshold_ms as i64 {
        Some(AlertChannel::Fullscreen)
    } else if alerts.notification_enabled
        && distracted_for >= alerts.notification_threshold_ms as i64
    {
        Some(AlertChannel::Notification)
    } else {
        None
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TickPayload {
    pub session_id: String,
    pub focus_ms: i64,
    pub distracted_ms: i64,
    pub total_ms: i64,
    pub focus_percent: f64,
    pub alert_count: i64,
    pub is_distracted: bool,
    pub is_paused: bool,
    pub is_idle: bool,
    pub on_break: bool,
    pub idle_ms: i64,
    pub current_app: Option<String>,
    pub current_title: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct AlertPayload {
    pub session_id: String,
    pub app_name: String,
    pub distracted_ms: i64,
    pub alert_type: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct WindowChangedPayload {
    pub app_name: String,
    pub app_exe: String,
    pub title: String,
    pub is_distraction: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct BreakReminderPayload {
    pub session_id: String,
    pub focused_ms: i64,
    pub alert_type: String,
}

fn tick_payload(session: &SessionData) -> TickPayload {
    TickPayload {
        session_id: session.session.id.clone(),
        focus_ms: session.focus_ms,
        distracted_ms: session.distracted_ms,
        total_ms: session.focus_ms + session.distracted_ms + session.idle_ms,
        focus_percent: focus_percent(session.focus_ms, session.distracted_ms, session.idle_ms),
        alert_count: session.alert_count,
        is_distracted: session.is_distracted,
        is_paused: session.paused,
        is_idle: session.is_idle,
        on_break: session.on_break,
        idle_ms: session.idle_ms,
        current_app: session
            .last_window
            .as_ref()
            .map(|window| window.app_name.clone()),
        current_title: session
            .last_window
            .as_ref()
            .map(|window| window.clean_title.clone()),
    }
}

pub fn start_monitor(
    app: AppHandle,
    state: &AppState,
    session_data: &mut SessionData,
) -> Result<()> {
    let polling_ms = {
        let settings = state
            .settings
            .lock()
            .map_err(|_| crate::error::AppError::Internal("lock".into()))?;
        settings.general.polling_interval_ms
    };

    let (stop_tx, stop_rx) = oneshot::channel::<()>();
    session_data.monitor_stop_tx = Some(stop_tx);

    let session_id = session_data.session.id.clone();
    let active_session = Arc::clone(&state.active_session);
    let settings = Arc::clone(&state.settings);
    let logger = Arc::clone(&state.logger);

    // ── 1-second ticker: time accumulation + ALERT CHECKING ────────────────────
    // KEY FIX: alerts were only checked on window change events, so if the user
    // stayed in the same distraction app without switching, alerts never fired.
    // Now alerts are checked every second in this ticker.
    {
        let active = Arc::clone(&active_session);
        let settings_tick = Arc::clone(&settings);
        let logger_tick = Arc::clone(&logger);
        let app_tick = app.clone();
        let sid = session_id.clone();
        // Cache ioreg calls (only check idle every 5s to avoid subprocess overhead)
        let mut idle_cache_ms: u64 = 0;
        let mut idle_cache_tick: u64 = 0;

        tokio::spawn(async move {
            let mut interval = time::interval(Duration::from_millis(1000));
            let mut tick_count: u64 = 0;

            loop {
                interval.tick().await;
                tick_count += 1;

                let should_continue = {
                    if let Ok(mut lock) = active.lock() {
                        if let Some(ref mut s) = *lock {
                            if s.session.id != sid {
                                false
                            } else if s.paused || s.on_break {
                                let now = now_ms();
                                s.last_tick_ms = now;
                                let break_finished = s.on_break
                                    && s.break_started_at_ms.is_some_and(|started| {
                                        settings_tick.lock().is_ok_and(|settings| {
                                            now - started
                                                >= settings.breaks.break_duration_ms as i64
                                        })
                                    });
                                if break_finished {
                                    s.on_break = false;
                                    s.break_started_at_ms = None;
                                    s.continuous_focus_start_ms = Some(now);
                                    if let Ok(mut log) = logger_tick.lock() {
                                        let _ = log.record_event(
                                            &sid,
                                            EventType::BreakEnd,
                                            None,
                                            None,
                                            None,
                                            false,
                                            false,
                                            None,
                                        );
                                    }
                                    let _ = app_tick.emit("break:ended", ());
                                }
                                let _ = app_tick.emit("session:tick", tick_payload(s));
                                if tick_count.is_multiple_of(5) {
                                    if let Ok(log) = logger_tick.lock() {
                                        let _ = log.persist_runtime(&s.runtime_snapshot(now));
                                    }
                                }
                                true
                            } else {
                                let now = now_ms();
                                let elapsed = now - s.last_tick_ms;
                                s.last_tick_ms = now;
                                let interrupted = ticker_was_suspended(elapsed);
                                if interrupted {
                                    s.paused = true;
                                    s.is_idle = false;
                                    tracing::info!(
                                        session_id = %sid,
                                        elapsed,
                                        "Pausing session after a suspended ticker"
                                    );
                                }

                                if !interrupted {
                                    // Idle detection: cache every 5 ticks to avoid subprocess overhead
                                    if tick_count - idle_cache_tick >= 5 {
                                        idle_cache_ms = get_idle_time_ms();
                                        idle_cache_tick = tick_count;
                                    }
                                    s.is_idle = idle_cache_ms >= 60_000;

                                    // Time accumulation
                                    if s.is_idle {
                                        s.idle_ms += elapsed;
                                    } else if s.is_distracted {
                                        s.distracted_ms += elapsed;
                                    } else {
                                        s.focus_ms += elapsed;
                                    }

                                    if let Ok(settings) = settings_tick.lock() {
                                        let breaks = &settings.breaks;
                                        if breaks.enabled
                                            && !s.is_distracted
                                            && !s.is_idle
                                            && !s.on_break
                                        {
                                            let focused_for = s
                                                .continuous_focus_start_ms
                                                .map(|started| now - started)
                                                .unwrap_or(0);
                                            let reminder_due = focused_for
                                                >= breaks.focus_interval_ms as i64
                                                && s.last_break_reminder_ms.is_none_or(|last| {
                                                    now - last >= breaks.focus_interval_ms as i64
                                                });
                                            if reminder_due {
                                                s.last_break_reminder_ms = Some(now);
                                                let _ = app_tick.emit(
                                                    "break:reminder",
                                                    BreakReminderPayload {
                                                        session_id: sid.clone(),
                                                        focused_ms: focused_for,
                                                        alert_type: breaks.alert_type.clone(),
                                                    },
                                                );
                                            }
                                        }
                                    }

                                    // ── ALERT CHECK (every tick, not just on window change) ──
                                    if s.is_distracted && !s.is_idle {
                                        if s.distracted_since_ms.is_none() {
                                            s.distracted_since_ms = Some(now);
                                        }

                                        let distracted_for =
                                            now - s.distracted_since_ms.unwrap_or(now);
                                        let cooldown_ok = s
                                            .last_alert_ms
                                            .map(|t| {
                                                now - t >= {
                                                    settings_tick
                                                        .lock()
                                                        .map(|set| set.alerts.cooldown_ms as i64)
                                                        .unwrap_or(10_000)
                                                }
                                            })
                                            .unwrap_or(true);

                                        if let Ok(settings) = settings_tick.lock() {
                                            let alerts = &settings.alerts;
                                            let selected = select_alert_channel(
                                                alerts,
                                                distracted_for,
                                                cooldown_ok,
                                            );

                                            if selected == Some(AlertChannel::Notification) {
                                                s.alert_count += 1;
                                                s.last_alert_ms = Some(now);
                                                tracing::info!(
                                                "ALERT notification: distracted for {}ms (threshold {}ms)",
                                                distracted_for, alerts.notification_threshold_ms
                                            );
                                                let _ = app_tick.emit(
                                                    "alert:show",
                                                    AlertPayload {
                                                        session_id: sid.clone(),
                                                        app_name: s
                                                            .last_window
                                                            .as_ref()
                                                            .map(|w| w.app_name.clone())
                                                            .unwrap_or_default(),
                                                        distracted_ms: distracted_for,
                                                        alert_type: "notification".to_string(),
                                                    },
                                                );
                                            }

                                            if selected == Some(AlertChannel::Fullscreen) {
                                                s.alert_count += 1;
                                                s.last_alert_ms = Some(now);
                                                let alert_app = s
                                                    .last_window
                                                    .as_ref()
                                                    .map(|w| w.app_name.clone())
                                                    .unwrap_or_default();
                                                let window_title = s
                                                    .last_window
                                                    .as_ref()
                                                    .map(|w| w.clean_title.clone())
                                                    .filter(|title| !title.is_empty());
                                                let overlay_payload =
                                                    crate::models::OverlayAlertPayload {
                                                        session_id: sid.clone(),
                                                        app_name: alert_app.clone(),
                                                        window_title,
                                                        distracted_ms: distracted_for,
                                                        session_elapsed_ms: now
                                                            - s.session.started_at,
                                                        focus_ms: s.focus_ms,
                                                        idle_ms: s.idle_ms,
                                                        alert_started_at_ms: now,
                                                        is_test: false,
                                                        language: settings.general.language.clone(),
                                                        time_format: settings
                                                            .general
                                                            .time_format
                                                            .clone(),
                                                    };
                                                tracing::info!(
                                                "ALERT fullscreen: distracted for {}ms (threshold {}ms)",
                                                distracted_for, alerts.fullscreen_threshold_ms
                                            );
                                                // Use the dedicated overlay window instead of emitting.
                                                // Window operations are scheduled onto Tauri's main thread.
                                                let _ =
                                                    crate::commands::monitor::show_overlay_payload(
                                                        &app_tick,
                                                        overlay_payload,
                                                    );
                                                // Emit so the frontend can play the configured overlay sound.
                                                let _ = app_tick.emit(
                                                    "alert:fullscreen",
                                                    AlertPayload {
                                                        session_id: sid.clone(),
                                                        app_name: alert_app,
                                                        distracted_ms: distracted_for,
                                                        alert_type: "fullscreen".to_string(),
                                                    },
                                                );
                                            }
                                        }
                                    }
                                }
                                // ────────────────────────────────────────────────────────

                                let _ = app_tick.emit("session:tick", tick_payload(s));
                                if interrupted || tick_count.is_multiple_of(5) {
                                    if let Ok(log) = logger_tick.lock() {
                                        let _ = log.persist_runtime(&s.runtime_snapshot(now));
                                    }
                                }
                                true
                            }
                        } else {
                            false // session gone
                        }
                    } else {
                        false
                    }
                };

                if !should_continue {
                    break;
                }
            }
        });
    }

    // ── Window-change detector ──────────────────────────────────────────────────
    tokio::spawn(async move {
        let on_change = build_on_change(app, session_id, settings, active_session, logger);
        monitor_loop(polling_ms, 0, on_change, stop_rx).await;
    });

    Ok(())
}

/// Handles window changes: updates distraction state, fires break reminders,
/// logs to DB. Alert checking was moved to the ticker above.
fn build_on_change(
    app: AppHandle,
    session_id: String,
    settings: Arc<Mutex<AppSettings>>,
    active_session: Arc<Mutex<Option<SessionData>>>,
    logger: Arc<Mutex<SessionLogger>>,
) -> impl FnMut(WindowChangeEvent) + Send + 'static {
    move |event: WindowChangeEvent| {
        let focus_rules: FocusRules = {
            match settings.lock() {
                Ok(s) => s.focus_rules.clone(),
                Err(_) => return,
            }
        };

        let is_distraction = RuleEngine::is_distraction(&focus_rules, &event.window);

        let mut runtime_snapshot = None;
        if let Ok(mut active) = active_session.lock() {
            if let Some(ref mut s) = *active {
                if s.paused {
                    return;
                }

                let now = now_ms();
                let was_distracted = s.is_distracted;

                // Update window state
                s.is_distracted = is_distraction;
                s.last_window = Some(event.window.clone());

                // Track distraction start/clear
                if is_distraction {
                    if s.distracted_since_ms.is_none() {
                        s.distracted_since_ms = Some(now);
                    }
                } else {
                    s.distracted_since_ms = None;
                }

                if !is_distraction {
                    if was_distracted || s.continuous_focus_start_ms.is_none() {
                        s.continuous_focus_start_ms = Some(now);
                    }
                } else if is_distraction {
                    s.continuous_focus_start_ms = None;
                }

                let _ = app.emit(
                    "window:changed",
                    WindowChangedPayload {
                        app_name: event.window.app_name.clone(),
                        app_exe: event.window.app_exe.clone(),
                        title: event.window.clean_title.clone(),
                        is_distraction,
                    },
                );
                runtime_snapshot = Some(s.runtime_snapshot(now));
            }
        }

        // Log event to DB
        if let Ok(mut log) = logger.lock() {
            let event_type = if event.change_type == "title_change" {
                EventType::TitleChange
            } else {
                EventType::AppFocus
            };
            let _ = log.record_event(
                &session_id,
                event_type,
                Some(event.window.app_name),
                Some(event.window.app_exe),
                Some(event.window.clean_title),
                event.window.is_browser,
                is_distraction,
                None,
            );
            if let Some(snapshot) = runtime_snapshot.as_ref() {
                let _ = log.persist_runtime(snapshot);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{select_alert_channel, ticker_was_suspended, AlertChannel};
    use crate::models::settings::AlertSettings;

    #[test]
    fn long_ticker_gap_requires_session_pause() {
        assert!(!ticker_was_suspended(10_000));
        assert!(ticker_was_suspended(10_001));
    }

    #[test]
    fn alert_threshold_and_cooldown_boundaries_are_inclusive() {
        let alerts = AlertSettings {
            notification_enabled: true,
            notification_threshold_ms: 30_000,
            fullscreen_enabled: true,
            fullscreen_threshold_ms: 60_000,
            cooldown_ms: 10_000,
        };
        assert_eq!(select_alert_channel(&alerts, 29_999, true), None);
        assert_eq!(
            select_alert_channel(&alerts, 30_000, true),
            Some(AlertChannel::Notification)
        );
        assert_eq!(select_alert_channel(&alerts, 60_000, false), None);
        assert_eq!(
            select_alert_channel(&alerts, 60_000, true),
            Some(AlertChannel::Fullscreen)
        );
    }
}

//! Central owner of tray presentation state (spec: tray-status).
//!
//! Session state changes and the 1-second ticker funnel through this manager,
//! which dedupes icon/tooltip updates and rebuilds the localized tray menu when
//! the frontend pushes new labels. It is the seed of the multi-window status
//! broadcast planned for the app-modes change.

use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::image::Image;
use tauri::menu::{IconMenuItem, Menu, PredefinedMenuItem};
use tauri::{AppHandle, Emitter, Manager, Runtime};

pub const TRAY_ID: &str = "LazyNevis";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TraySessionState {
    Idle,
    Running,
    Paused,
}

/// Main-window presentation mode (spec: app-modes).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AppMode {
    Full,
    Compact,
}

impl AppMode {
    pub fn parse(value: &str) -> Result<Self> {
        match value {
            "full" => Ok(Self::Full),
            "compact" => Ok(Self::Compact),
            other => Err(AppError::InvalidArgument(format!(
                "Invalid app mode '{other}'"
            ))),
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Full => "full",
            Self::Compact => "compact",
        }
    }
}

/// Broadcast to every window on each status change (spec: app-modes/hydration-on-open).
#[derive(Debug, Clone, Serialize)]
pub struct AppStatusPayload {
    pub mode: AppMode,
    pub pinned: bool,
    pub session_state: TraySessionState,
    pub session_elapsed_ms: i64,
    /// True while the main window is in native OS fullscreen
    /// (spec: app-modes/fullscreen-follows-full-mode).
    pub is_fullscreen: bool,
}

#[derive(Debug, Clone)]
pub struct SessionSummary {
    pub state: TraySessionState,
    pub elapsed_ms: i64,
}

impl SessionSummary {
    pub fn idle() -> Self {
        Self {
            state: TraySessionState::Idle,
            elapsed_ms: 0,
        }
    }
}

/// Localized strings pushed by the frontend (the i18n owner). English defaults
/// cover the window between startup and the first push.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct TrayLabels {
    pub show: String,
    pub toggle_focus: String,
    pub stop_session: String,
    pub quit: String,
    pub state_idle: String,
    pub state_running: String,
    pub state_paused: String,
    /// Linux fallback menu entry (appindicator delivers no icon clicks).
    pub open_quick_panel: String,
}

impl Default for TrayLabels {
    fn default() -> Self {
        Self {
            show: "Open LazyNevis".to_string(),
            toggle_focus: "Start Focus Session".to_string(),
            stop_session: "Stop Session".to_string(),
            quit: "Quit".to_string(),
            state_idle: "Idle".to_string(),
            state_running: "Focusing".to_string(),
            state_paused: "Paused".to_string(),
            open_quick_panel: "Quick Panel".to_string(),
        }
    }
}

/// Pure transition logic for native-fullscreen tracking
/// (spec: app-modes/fullscreen-follows-full-mode). Returns `None` when the
/// fullscreen state hasn't actually changed (no-op). Entering fullscreen while
/// Compact remembers Compact for restoration; exiting restores it if present.
fn next_fullscreen_transition(
    mode: AppMode,
    was_fullscreen: bool,
    now_fullscreen: bool,
    restore: Option<AppMode>,
) -> Option<(AppMode, Option<AppMode>, bool)> {
    if was_fullscreen == now_fullscreen {
        return None;
    }
    if now_fullscreen {
        if mode == AppMode::Compact {
            Some((AppMode::Full, Some(AppMode::Compact), true))
        } else {
            Some((mode, None, true))
        }
    } else {
        match restore {
            Some(previous) => Some((previous, None, false)),
            None => Some((mode, None, false)),
        }
    }
}

/// Embedded PNG bytes for the tray icon of a given state.
///
/// Compiled directly into the binary rather than resolved via
/// `BaseDirectory::Resource` at runtime: Tauri's `"icons/**/*": "icons/"`
/// resource glob flattens subdirectories, so `icons/tray/idle_monochrome.png`
/// is actually copied to `icons/idle_monochrome.png` — a path-resolved lookup
/// for `icons/tray/idle_monochrome.png` silently fails and falls back to the
/// app's default (non-template-shaped) icon, which renders as a plain filled
/// square once `icon_as_template` forces template compositing on it. This bit
/// LazyNevis in production; `include_bytes!` sidesteps the whole class of bug.
pub fn icon_bytes(state: TraySessionState) -> &'static [u8] {
    match state {
        TraySessionState::Idle => include_bytes!("../../icons/tray/idle_monochrome.png"),
        TraySessionState::Running => include_bytes!("../../icons/tray/running_monochrome.png"),
        TraySessionState::Paused => include_bytes!("../../icons/tray/paused_monochrome.png"),
    }
}

fn format_hms(ms: i64) -> String {
    let total_seconds = (ms.max(0)) / 1000;
    format!(
        "{:02}:{:02}:{:02}",
        total_seconds / 3600,
        (total_seconds % 3600) / 60,
        total_seconds % 60
    )
}

/// `"{state} — HH:MM:SS"` while active, plain state label when idle.
pub fn format_tooltip(labels: &TrayLabels, summary: &SessionSummary) -> String {
    match summary.state {
        TraySessionState::Idle => labels.state_idle.clone(),
        TraySessionState::Running => format!(
            "{} \u{2014} {}",
            labels.state_running,
            format_hms(summary.elapsed_ms)
        ),
        TraySessionState::Paused => format!(
            "{} \u{2014} {}",
            labels.state_paused,
            format_hms(summary.elapsed_ms)
        ),
    }
}

/// Shared between `setup_tray` and label refreshes so both build the same menu.
/// Only two entries — session controls live in the quick panel
/// (spec: tray-status/minimal-native-menu).
pub fn build_tray_menu<R: Runtime, M: Manager<R>>(
    manager: &M,
    labels: &TrayLabels,
) -> tauri::Result<Menu<R>> {
    // Mid-gray glyphs stay legible on both light and dark menu themes.
    let open_icon = Image::from_bytes(include_bytes!("../../icons/tray/menu_open.png")).ok();
    let quit_icon = Image::from_bytes(include_bytes!("../../icons/tray/menu_quit.png")).ok();

    let show = IconMenuItem::with_id(manager, "show", &labels.show, true, open_icon, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(manager)?;
    let quit = IconMenuItem::with_id(manager, "quit", &labels.quit, true, quit_icon, None::<&str>)?;

    // Linux appindicator delivers no icon click events, so the quick panel needs
    // a menu entry there (spec: tray-quick-panel/linux-fallback).
    #[cfg(target_os = "linux")]
    {
        let quick_panel = IconMenuItem::with_id(
            manager,
            "open_quick_panel",
            &labels.open_quick_panel,
            true,
            None::<Image>,
            None::<&str>,
        )?;
        Menu::with_items(manager, &[&show, &quick_panel, &sep, &quit])
    }
    #[cfg(not(target_os = "linux"))]
    Menu::with_items(manager, &[&show, &sep, &quit])
}

#[derive(Debug)]
struct Inner {
    session: SessionSummary,
    labels: TrayLabels,
    applied_icon: Option<TraySessionState>,
    applied_tooltip: Option<String>,
    mode: AppMode,
    pinned: bool,
    is_fullscreen: bool,
    /// The mode to restore when native fullscreen ends, if entering fullscreen
    /// forced a switch to Full Mode (spec: app-modes/fullscreen-follows-full-mode).
    restore_mode_on_exit_fullscreen: Option<AppMode>,
}

#[derive(Debug)]
pub struct AppStatusManager {
    inner: Mutex<Inner>,
}

impl Default for AppStatusManager {
    fn default() -> Self {
        Self {
            inner: Mutex::new(Inner {
                session: SessionSummary::idle(),
                labels: TrayLabels::default(),
                // The idle icon is set by TrayIconBuilder at startup.
                applied_icon: Some(TraySessionState::Idle),
                applied_tooltip: None,
                mode: AppMode::Full,
                pinned: false,
                is_fullscreen: false,
                restore_mode_on_exit_fullscreen: None,
            }),
        }
    }
}

impl AppStatusManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn labels(&self) -> TrayLabels {
        self.inner
            .lock()
            .map(|inner| inner.labels.clone())
            .unwrap_or_default()
    }

    pub fn snapshot(&self) -> AppStatusPayload {
        self.inner
            .lock()
            .map(|inner| AppStatusPayload {
                mode: inner.mode,
                pinned: inner.pinned,
                session_state: inner.session.state,
                session_elapsed_ms: inner.session.elapsed_ms,
                is_fullscreen: inner.is_fullscreen,
            })
            .unwrap_or(AppStatusPayload {
                mode: AppMode::Full,
                pinned: false,
                session_state: TraySessionState::Idle,
                session_elapsed_ms: 0,
                is_fullscreen: false,
            })
    }

    pub fn mode(&self) -> AppMode {
        self.inner
            .lock()
            .map(|inner| inner.mode)
            .unwrap_or(AppMode::Full)
    }

    pub fn pinned(&self) -> bool {
        self.inner.lock().map(|inner| inner.pinned).unwrap_or(false)
    }

    /// Seed mode/pin from persisted settings at startup, without broadcasting.
    pub fn init_mode_pin(&self, mode: AppMode, pinned: bool) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.mode = mode;
            inner.pinned = pinned;
        }
    }

    pub fn set_mode(&self, app: &AppHandle, mode: AppMode) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.mode = mode;
        }
        self.broadcast(app);
    }

    pub fn set_pinned(&self, app: &AppHandle, pinned: bool) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.pinned = pinned;
        }
        self.broadcast(app);
    }

    /// Emits `app:status` to every window (spec: app-modes/consistent-status).
    pub fn broadcast(&self, app: &AppHandle) {
        let _ = app.emit("app:status", self.snapshot());
    }

    /// Reacts to native macOS fullscreen (the green traffic-light button), which
    /// resizes the same "main" window Tauri gives no dedicated event for — the
    /// caller checks `is_fullscreen()` on every `Resized` event and calls this
    /// with the result. Entering fullscreen from Compact Mode switches the
    /// in-memory (not persisted) mode to Full so the fullscreen window gets the
    /// layout meant for large screens; exiting restores whatever mode was active
    /// before, without ever touching the user's persisted preference or window
    /// geometry (spec: app-modes/fullscreen-follows-full-mode).
    pub fn sync_native_fullscreen(&self, app: &AppHandle, now_fullscreen: bool) {
        let changed = {
            let Ok(mut inner) = self.inner.lock() else {
                return;
            };
            let transition = next_fullscreen_transition(
                inner.mode,
                inner.is_fullscreen,
                now_fullscreen,
                inner.restore_mode_on_exit_fullscreen,
            );
            let Some((mode, restore, is_fullscreen)) = transition else {
                return;
            };
            inner.mode = mode;
            inner.restore_mode_on_exit_fullscreen = restore;
            inner.is_fullscreen = is_fullscreen;
            true
        };
        if changed {
            self.broadcast(app);
        }
    }

    /// Stores new localized labels, rebuilds the menu, and reapplies the tooltip.
    pub fn set_labels(&self, app: &AppHandle, labels: TrayLabels) {
        let tooltip = {
            let Ok(mut inner) = self.inner.lock() else {
                return;
            };
            inner.labels = labels.clone();
            let tooltip = format_tooltip(&inner.labels, &inner.session);
            inner.applied_tooltip = Some(tooltip.clone());
            tooltip
        };
        apply_to_tray(app, None, Some(tooltip), Some(labels));
    }

    /// Updates the cached session summary and pushes icon/tooltip changes to the
    /// tray, deduping unchanged values (the ticker calls this every second).
    pub fn update_session(&self, app: &AppHandle, summary: SessionSummary) {
        let (icon, tooltip) = {
            let Ok(mut inner) = self.inner.lock() else {
                return;
            };
            let icon = if inner.applied_icon != Some(summary.state) {
                inner.applied_icon = Some(summary.state);
                Some(summary.state)
            } else {
                None
            };
            let tooltip = format_tooltip(&inner.labels, &summary);
            let tooltip = if inner.applied_tooltip.as_deref() != Some(tooltip.as_str()) {
                inner.applied_tooltip = Some(tooltip.clone());
                Some(tooltip)
            } else {
                None
            };
            inner.session = summary;
            (icon, tooltip)
        };
        if icon.is_some() || tooltip.is_some() {
            apply_to_tray(app, icon, tooltip, None);
        }
        // The icon only changes on a state transition — broadcast those so other
        // windows stay consistent without per-second spam (ticks cover elapsed).
        if icon.is_some() {
            self.broadcast(app);
        }
    }
}

/// Applies changes on the main thread (tray APIs must not run on the ticker task
/// on macOS).
fn apply_to_tray(
    app: &AppHandle,
    icon: Option<TraySessionState>,
    tooltip: Option<String>,
    menu_labels: Option<TrayLabels>,
) {
    let app = app.clone();
    let result = app.clone().run_on_main_thread(move || {
        let Some(tray) = app.tray_by_id(TRAY_ID) else {
            return;
        };
        if let Some(state) = icon {
            if let Ok(image) = Image::from_bytes(icon_bytes(state)) {
                let _ = tray.set_icon(Some(image));
                let _ = tray.set_icon_as_template(true);
            }
        }
        if let Some(tooltip) = tooltip {
            // No-op on Linux appindicator (spec: tray-status/platform-without-tooltip-support).
            let _ = tray.set_tooltip(Some(&tooltip));
        }
        if let Some(labels) = menu_labels {
            if let Ok(menu) = build_tray_menu(&app, &labels) {
                let _ = tray.set_menu(Some(menu));
            }
        }
    });
    if let Err(error) = result {
        tracing::warn!(?error, "could not dispatch tray update to main thread");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Spec scenario: tray-status/active-session-tooltip
    #[test]
    fn test_tray_tooltip_formats_state_and_elapsed() {
        let labels = TrayLabels {
            state_running: "Focando".into(),
            state_paused: "Pausado".into(),
            state_idle: "Ocioso".into(),
            ..TrayLabels::default()
        };
        assert_eq!(
            format_tooltip(
                &labels,
                &SessionSummary {
                    state: TraySessionState::Running,
                    elapsed_ms: 83_000
                }
            ),
            "Focando \u{2014} 00:01:23"
        );
        assert_eq!(
            format_tooltip(
                &labels,
                &SessionSummary {
                    state: TraySessionState::Paused,
                    elapsed_ms: 3_661_000
                }
            ),
            "Pausado \u{2014} 01:01:01"
        );
        assert_eq!(format_tooltip(&labels, &SessionSummary::idle()), "Ocioso");
    }

    // Spec scenario: tray-status/icon-follows-lifecycle
    // Decodes through the same `Image::from_bytes` path used at runtime, so a
    // corrupt or mismatched embed fails the test instead of silently falling
    // back to the app's default icon (the exact bug this replaced — see
    // `icon_bytes`'s doc comment).
    #[test]
    fn tray_icon_bytes_decode_and_differ_per_state() {
        let idle = tauri::image::Image::from_bytes(icon_bytes(TraySessionState::Idle)).unwrap();
        let running =
            tauri::image::Image::from_bytes(icon_bytes(TraySessionState::Running)).unwrap();
        let paused = tauri::image::Image::from_bytes(icon_bytes(TraySessionState::Paused)).unwrap();

        assert_ne!(idle.rgba(), running.rgba());
        assert_ne!(running.rgba(), paused.rgba());
        assert_ne!(idle.rgba(), paused.rgba());
    }

    // Spec scenario: app-modes/fullscreen-follows-full-mode
    #[test]
    fn entering_fullscreen_from_compact_switches_to_full_and_remembers() {
        let transition = next_fullscreen_transition(AppMode::Compact, false, true, None);
        assert_eq!(
            transition,
            Some((AppMode::Full, Some(AppMode::Compact), true))
        );
    }

    #[test]
    fn exiting_fullscreen_restores_the_remembered_mode() {
        let transition =
            next_fullscreen_transition(AppMode::Full, true, false, Some(AppMode::Compact));
        assert_eq!(transition, Some((AppMode::Compact, None, false)));
    }

    #[test]
    fn entering_fullscreen_already_in_full_mode_is_a_no_op_switch() {
        let transition = next_fullscreen_transition(AppMode::Full, false, true, None);
        assert_eq!(transition, Some((AppMode::Full, None, true)));
    }

    #[test]
    fn exiting_fullscreen_with_nothing_remembered_keeps_current_mode() {
        let transition = next_fullscreen_transition(AppMode::Full, true, false, None);
        assert_eq!(transition, Some((AppMode::Full, None, false)));
    }

    #[test]
    fn unchanged_fullscreen_state_is_a_no_op() {
        assert_eq!(
            next_fullscreen_transition(AppMode::Compact, true, true, Some(AppMode::Compact)),
            None
        );
        assert_eq!(
            next_fullscreen_transition(AppMode::Full, false, false, None),
            None
        );
    }

    #[test]
    fn labels_default_to_current_english_strings() {
        let labels = TrayLabels::default();
        assert_eq!(labels.show, "Open LazyNevis");
        assert_eq!(labels.toggle_focus, "Start Focus Session");
        assert_eq!(labels.stop_session, "Stop Session");
        assert_eq!(labels.quit, "Quit");
    }

    #[test]
    fn negative_elapsed_clamps_to_zero() {
        assert_eq!(format_hms(-5_000), "00:00:00");
    }
}

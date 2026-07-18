//! Centralized OS-notification dispatch.
//!
//! Every application-originated notification goes through [`notify`], which applies a
//! [`NotificationPolicy`] before handing the message to the platform-specific sender.
//! Spec: `notification-feedback` (single dispatch path + inactive-only lifecycle feedback).

use crate::error::{AppError, Result};
#[cfg(target_os = "macos")]
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NotificationPolicy {
    /// Deliver unconditionally (alerts, break reminders, recovery).
    Always,
    /// Deliver only when the main window is hidden or unfocused (session lifecycle feedback).
    OnlyWhenAppInactive,
}

/// Pure policy decision, kept free of Tauri types for unit testing.
pub fn should_send(policy: NotificationPolicy, main_visible: bool, main_focused: bool) -> bool {
    match policy {
        NotificationPolicy::Always => true,
        NotificationPolicy::OnlyWhenAppInactive => !(main_visible && main_focused),
    }
}

fn main_window_state(app: &AppHandle) -> (bool, bool) {
    match app.get_webview_window("main") {
        Some(window) => (
            window.is_visible().unwrap_or(false),
            window.is_focused().unwrap_or(false),
        ),
        None => (false, false),
    }
}

pub async fn notify(
    app: &AppHandle,
    title: String,
    body: String,
    policy: NotificationPolicy,
) -> Result<()> {
    if title.trim().is_empty() || title.len() > 200 || body.len() > 2_000 {
        return Err(AppError::InvalidArgument(
            "Notification title or body is invalid".into(),
        ));
    }
    let (visible, focused) = main_window_state(app);
    if !should_send(policy, visible, focused) {
        return Ok(());
    }
    send_platform(title, body, app).await
}

#[cfg(target_os = "macos")]
async fn send_platform(title: String, body: String, app: &AppHandle) -> Result<()> {
    let icon_path =
        resolve_notification_icon(app).and_then(|path| path.to_str().map(ToOwned::to_owned));
    let bundle_identifier = app.config().identifier.clone();
    let (tx, rx) = std::sync::mpsc::channel();

    app.run_on_main_thread(move || {
        // Tauri dev runs as a standalone binary, so its bundle identifier is not
        // registered with Launch Services. Setting a known identity prevents
        // mac-notification-sys from searching for an app named "use_default".
        let notification_identity = if tauri::is_dev() {
            "com.apple.Terminal"
        } else {
            &bundle_identifier
        };
        let _ = mac_notification_sys::set_application(notification_identity);

        let mut notification = mac_notification_sys::Notification::new();
        notification.title(&title).message(&body).asynchronous(true);

        if let Some(icon_path) = icon_path.as_deref() {
            notification.app_icon(icon_path);
        }

        let result = notification
            .send()
            .map(|_| ())
            .map_err(|error| AppError::Internal(error.to_string()));
        let _ = tx.send(result);
    })
    .map_err(|error| AppError::Internal(error.to_string()))?;

    rx.recv()
        .map_err(|error| AppError::Internal(error.to_string()))?
}

#[cfg(not(target_os = "macos"))]
async fn send_platform(title: String, body: String, app: &AppHandle) -> Result<()> {
    use tauri_plugin_notification::NotificationExt;

    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|error| AppError::Internal(error.to_string()))
}

#[cfg(target_os = "macos")]
fn resolve_notification_icon(app: &AppHandle) -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("icons").join("icon.icns"));
        candidates.push(resource_dir.join("icons").join("icon.png"));
    }

    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(
            current_dir
                .join("src-tauri")
                .join("icons")
                .join("icon.icns"),
        );
        candidates.push(current_dir.join("src-tauri").join("icons").join("icon.png"));
        candidates.push(current_dir.join("icons").join("icon.icns"));
        candidates.push(current_dir.join("icons").join("icon.png"));
    }

    candidates.into_iter().find(|path| path.exists())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Spec scenario: notification-feedback/shortcut-trigger-while-app-inactive
    #[test]
    fn test_notification_feedback_inactive_only() {
        use NotificationPolicy::*;
        // Visible + focused = the only state where lifecycle feedback is suppressed.
        assert!(!should_send(OnlyWhenAppInactive, true, true));
        assert!(should_send(OnlyWhenAppInactive, true, false));
        assert!(should_send(OnlyWhenAppInactive, false, false));
        assert!(should_send(OnlyWhenAppInactive, false, true));
    }

    // Spec scenario: notification-feedback/single-dispatch (Always policy never filters)
    #[test]
    fn test_notification_always_policy_ignores_window_state() {
        for visible in [true, false] {
            for focused in [true, false] {
                assert!(should_send(NotificationPolicy::Always, visible, focused));
            }
        }
    }
}

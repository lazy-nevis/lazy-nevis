use crate::error::{AppError, Result};
#[cfg(target_os = "macos")]
use std::path::PathBuf;
use tauri::AppHandle;
#[cfg(target_os = "macos")]
use tauri::Manager;

#[tauri::command]
pub async fn send_app_notification(title: String, body: String, app: AppHandle) -> Result<()> {
    if title.trim().is_empty() || title.len() > 200 || body.len() > 2_000 {
        return Err(AppError::InvalidArgument(
            "Notification title or body is invalid".into(),
        ));
    }
    send_app_notification_inner(title, body, app).await
}

#[cfg(target_os = "macos")]
async fn send_app_notification_inner(title: String, body: String, app: AppHandle) -> Result<()> {
    let icon_path =
        resolve_notification_icon(&app).and_then(|path| path.to_str().map(ToOwned::to_owned));
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
async fn send_app_notification_inner(title: String, body: String, app: AppHandle) -> Result<()> {
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

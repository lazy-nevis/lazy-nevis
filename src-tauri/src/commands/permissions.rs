use crate::error::Result;
use crate::services::permissions::{check_all, open_accessibility_prefs, PermissionsStatus};

#[tauri::command]
pub async fn check_permissions() -> Result<PermissionsStatus> {
    Ok(check_all())
}

#[tauri::command]
pub async fn open_accessibility_settings() -> Result<()> {
    open_accessibility_prefs();
    Ok(())
}

/// Trigger the notification permission request via the Tauri plugin.
/// The actual grant/deny is handled by tauri-plugin-notification on the frontend.
#[tauri::command]
pub async fn request_notification_permission() -> Result<()> {
    // The frontend uses @tauri-apps/plugin-notification for the actual request.
    // This command is a no-op placeholder for future native integration.
    Ok(())
}

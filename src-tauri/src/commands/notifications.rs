use crate::error::Result;
use crate::services::notifications::{notify, NotificationPolicy};
use tauri::AppHandle;

#[tauri::command]
pub async fn send_app_notification(
    title: String,
    body: String,
    only_if_inactive: Option<bool>,
    app: AppHandle,
) -> Result<()> {
    let policy = if only_if_inactive.unwrap_or(false) {
        NotificationPolicy::OnlyWhenAppInactive
    } else {
        NotificationPolicy::Always
    };
    notify(&app, title, body, policy).await
}

/// Session-recovery notice. Strings live here (not in frontend i18n) because it can fire
/// during startup before the webview has loaded — documented exception in the
/// `notification-feedback` spec design.
pub async fn send_recovery_notification(app: AppHandle, language: &str) -> Result<()> {
    let (title, body) = if language == "pt-BR" {
        (
            "LazyNevis \u{2014} Sess\u{e3}o recuperada".to_string(),
            "O LazyNevis n\u{e3}o foi finalizado corretamente. A sess\u{e3}o anterior foi pausada. Abra o app para continu\u{e1}-la.".to_string(),
        )
    } else {
        (
            "LazyNevis \u{2014} Session recovered".to_string(),
            "LazyNevis didn't close properly. Your previous session was paused. Open the app to continue it.".to_string(),
        )
    };
    notify(&app, title, body, NotificationPolicy::Always).await
}

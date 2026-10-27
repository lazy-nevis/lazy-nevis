use crate::commands::habits::QuickLogOpenPayload;
use crate::error::{AppError, Result};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

pub const QUICKLOG_WINDOW_LABEL: &str = "quicklog";

/// Pre-create the quick-log window hidden at startup (spec: habit-tracking).
pub fn ensure_quick_log_window(app: &AppHandle) -> Result<tauri::WebviewWindow> {
    if let Some(existing) = app.get_webview_window(QUICKLOG_WINDOW_LABEL) {
        return Ok(existing);
    }
    let builder = WebviewWindowBuilder::new(
        app,
        QUICKLOG_WINDOW_LABEL,
        WebviewUrl::App("#/quick-log".into()),
    )
    .title("LazyNevis")
    .inner_size(380.0, 480.0)
    .resizable(false)
    .always_on_top(true)
    .visible(false)
    .skip_taskbar(true);

    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);

    builder
        .build()
        .map_err(|e| AppError::Internal(e.to_string()))
}

pub fn open_quick_log_window(
    app: &AppHandle,
    habit_id: &str,
    event_id: Option<&str>,
) -> Result<()> {
    let window = ensure_quick_log_window(app)?;
    let _ = window.emit(
        "quicklog:open",
        QuickLogOpenPayload {
            habit_id: habit_id.to_string(),
            event_id: event_id.map(ToOwned::to_owned),
        },
    );
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

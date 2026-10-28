use crate::commands::habits::QuickLogOpenPayload;
use crate::error::{AppError, Result};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

pub const QUICKLOG_WINDOW_LABEL: &str = "quicklog";

/// Latest open request, kept until the window drains it. `quicklog:open` is
/// fire-and-forget, so a window whose listener is not registered yet would
/// otherwise lose the request (spec: habit-tracking/quick-log).
static PENDING_REQUEST: Mutex<Option<QuickLogOpenPayload>> = Mutex::new(None);

fn stash_request(slot: &Mutex<Option<QuickLogOpenPayload>>, payload: QuickLogOpenPayload) {
    if let Ok(mut pending) = slot.lock() {
        *pending = Some(payload);
    }
}

fn take_request(slot: &Mutex<Option<QuickLogOpenPayload>>) -> Option<QuickLogOpenPayload> {
    slot.lock().ok().and_then(|mut pending| pending.take())
}

/// Return and clear the pending quick-log request, if any.
#[tauri::command]
pub async fn take_quick_log_request() -> Result<Option<QuickLogOpenPayload>> {
    Ok(take_request(&PENDING_REQUEST))
}

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
    let payload = QuickLogOpenPayload {
        habit_id: habit_id.to_string(),
        event_id: event_id.map(ToOwned::to_owned),
    };
    stash_request(&PENDING_REQUEST, payload.clone());
    let _ = window.emit("quicklog:open", payload);
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn payload(habit_id: &str) -> QuickLogOpenPayload {
        QuickLogOpenPayload {
            habit_id: habit_id.to_string(),
            event_id: None,
        }
    }

    #[test]
    fn take_request_drains_the_slot() {
        let slot = Mutex::new(None);
        assert!(take_request(&slot).is_none());
        stash_request(&slot, payload("water"));
        assert_eq!(
            take_request(&slot).map(|p| p.habit_id),
            Some("water".into())
        );
        assert!(take_request(&slot).is_none());
    }

    #[test]
    fn stash_request_keeps_only_the_latest() {
        let slot = Mutex::new(None);
        stash_request(&slot, payload("water"));
        stash_request(&slot, payload("reading"));
        assert_eq!(
            take_request(&slot).map(|p| p.habit_id),
            Some("reading".into())
        );
    }
}

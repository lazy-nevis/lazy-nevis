use crate::error::{AppError, Result};
use crate::models::calendar::CalendarRange;
use crate::services::calendar::CalendarService;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_calendar_range(
    from_ms: i64,
    to_ms: i64,
    kinds: Option<Vec<String>>,
    state: State<'_, AppState>,
) -> Result<CalendarRange> {
    let db = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    CalendarService::range(&db, from_ms, to_ms, kinds)
}

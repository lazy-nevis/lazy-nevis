use crate::error::{AppError, Result};
use crate::models::{ChecklistItem, Tag};
use crate::services::checklist::HistorySort;
use crate::state::{now_ms, AppState};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

const MAX_TITLE_LEN: usize = 500;
const MAX_TAGS: usize = 20;
const MAX_TAG_LEN: usize = 50;

/// Broadcast after every mutation so all windows re-fetch (spec: daily-checklist).
#[derive(Debug, Clone, Serialize)]
pub struct ChecklistChangedPayload {
    pub reason: String,
    pub item_id: Option<String>,
}

fn emit_changed(app: &AppHandle, reason: &str, item_id: Option<String>) {
    let _ = app.emit(
        "checklist:changed",
        ChecklistChangedPayload {
            reason: reason.to_string(),
            item_id,
        },
    );
}

fn validate_item_args(title: &str, tags: &[String]) -> Result<()> {
    if title.trim().is_empty() || title.len() > MAX_TITLE_LEN {
        return Err(AppError::InvalidArgument(format!(
            "Checklist item title must be 1–{MAX_TITLE_LEN} characters"
        )));
    }
    if tags.len() > MAX_TAGS || tags.iter().any(|tag| tag.len() > MAX_TAG_LEN) {
        return Err(AppError::InvalidArgument(format!(
            "At most {MAX_TAGS} tags of up to {MAX_TAG_LEN} characters each"
        )));
    }
    Ok(())
}

fn grace_cutoff(state: &AppState) -> Result<i64> {
    let grace_ms = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .checklist
        .grace_period_ms as i64;
    Ok(now_ms() - grace_ms)
}

#[derive(Debug, Deserialize)]
pub struct CreateChecklistItemArgs {
    pub title: String,
    pub due_date: Option<i64>,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[tauri::command]
pub async fn create_checklist_item(
    args: CreateChecklistItemArgs,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ChecklistItem> {
    validate_item_args(&args.title, &args.tags)?;
    let item = state.checklist.create(
        args.title.trim().to_string(),
        args.due_date,
        args.tags,
        now_ms(),
    )?;
    emit_changed(&app, "created", Some(item.id.clone()));
    Ok(item)
}

#[derive(Debug, Deserialize)]
pub struct UpdateChecklistItemArgs {
    pub id: String,
    pub title: String,
    pub due_date: Option<i64>,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[tauri::command]
pub async fn update_checklist_item(
    args: UpdateChecklistItemArgs,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ChecklistItem> {
    validate_item_args(&args.title, &args.tags)?;
    let item = state.checklist.update(
        &args.id,
        args.title.trim().to_string(),
        args.due_date,
        args.tags,
        now_ms(),
    )?;
    emit_changed(&app, "updated", Some(item.id.clone()));
    Ok(item)
}

#[tauri::command]
pub async fn complete_checklist_item(
    id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ChecklistItem> {
    let item = state.checklist.set_completed(&id, Some(now_ms()))?;
    emit_changed(&app, "completed", Some(id));
    Ok(item)
}

#[tauri::command]
pub async fn uncomplete_checklist_item(
    id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ChecklistItem> {
    let item = state.checklist.set_completed(&id, None)?;
    emit_changed(&app, "uncompleted", Some(id));
    Ok(item)
}

#[tauri::command]
pub async fn delete_checklist_item(
    id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    state.checklist.delete(&id)?;
    emit_changed(&app, "deleted", Some(id));
    Ok(())
}

#[tauri::command]
pub async fn reorder_checklist_items(
    ids: Vec<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    if ids.len() > 10_000 {
        return Err(AppError::InvalidArgument("Too many items".into()));
    }
    state.checklist.reorder(&ids)?;
    emit_changed(&app, "reordered", None);
    Ok(())
}

/// Open items plus recently-completed ones still inside the grace window.
#[tauri::command]
pub async fn list_open_checklist_items(state: State<'_, AppState>) -> Result<Vec<ChecklistItem>> {
    let cutoff = grace_cutoff(&state)?;
    state.checklist.list_open(cutoff)
}

#[derive(Debug, Deserialize)]
pub struct ChecklistHistoryArgs {
    pub from: Option<i64>,
    pub to: Option<i64>,
    pub sort: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[tauri::command]
pub async fn list_checklist_history(
    args: ChecklistHistoryArgs,
    state: State<'_, AppState>,
) -> Result<Vec<ChecklistItem>> {
    let sort = HistorySort::parse(&args.sort)?;
    state
        .checklist
        .list_history(args.from, args.to, sort, &args.tags)
}

#[tauri::command]
pub async fn list_checklist_tags(state: State<'_, AppState>) -> Result<Vec<Tag>> {
    state.checklist.list_tags()
}

#[tauri::command]
pub async fn link_checklist_session(
    item_id: String,
    session_id: String,
    state: State<'_, AppState>,
) -> Result<()> {
    state
        .checklist
        .link_session(&item_id, &session_id, now_ms())
}

/// Latest still-open item linked to the session, for the stop-completion prompt.
#[tauri::command]
pub async fn get_linked_checklist_item(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<Option<ChecklistItem>> {
    state.checklist.open_item_for_session(&session_id)
}

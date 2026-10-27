use crate::error::{AppError, Result};
use crate::models::{ChecklistCategory, ChecklistItem, Priority, Tag};
use crate::services::checklist::{CreateItem, HistorySort, UpdateItem};
use crate::state::{now_ms, AppState};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

const MAX_TITLE_LEN: usize = 500;
const MAX_TAGS: usize = 20;
const MAX_TAG_LEN: usize = 50;

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

fn parse_priority(value: Option<String>) -> Priority {
    match value {
        None => Priority::None,
        Some(raw) => Priority::parse_token(&raw).unwrap_or(Priority::None),
    }
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
    pub due_has_time: bool,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub parent_id: Option<String>,
}

#[tauri::command]
pub async fn create_checklist_item(
    args: CreateChecklistItemArgs,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ChecklistItem> {
    validate_item_args(&args.title, &args.tags)?;
    let item = state.checklist.create(
        CreateItem {
            title: args.title.trim().to_string(),
            due_date: args.due_date,
            due_has_time: args.due_has_time,
            tags: args.tags,
            category: args.category,
            priority: parse_priority(args.priority),
            parent_id: args.parent_id,
        },
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
    pub due_has_time: bool,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
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
        UpdateItem {
            title: args.title.trim().to_string(),
            due_date: args.due_date,
            due_has_time: args.due_has_time,
            tags: args.tags,
            category: args.category,
            priority: parse_priority(args.priority),
        },
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
    #[serde(default)]
    pub categories: Vec<String>,
}

#[tauri::command]
pub async fn list_checklist_history(
    args: ChecklistHistoryArgs,
    state: State<'_, AppState>,
) -> Result<Vec<ChecklistItem>> {
    let sort = HistorySort::parse(&args.sort)?;
    state
        .checklist
        .list_history(args.from, args.to, sort, &args.tags, &args.categories)
}

#[tauri::command]
pub async fn list_checklist_tags(state: State<'_, AppState>) -> Result<Vec<Tag>> {
    state.checklist.list_tags()
}

#[tauri::command]
pub async fn list_checklist_categories(
    state: State<'_, AppState>,
) -> Result<Vec<ChecklistCategory>> {
    state.checklist.list_categories()
}

#[derive(Debug, Deserialize)]
pub struct CreateChecklistCategoryArgs {
    pub name: String,
    pub tone: Option<String>,
}

#[tauri::command]
pub async fn create_checklist_category(
    args: CreateChecklistCategoryArgs,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ChecklistCategory> {
    let category = state
        .checklist
        .create_category(args.name, args.tone, now_ms())?;
    emit_changed(&app, "category_created", None);
    Ok(category)
}

#[derive(Debug, Deserialize)]
pub struct UpdateChecklistCategoryArgs {
    pub id: String,
    pub name: String,
    pub tone: String,
}

#[tauri::command]
pub async fn update_checklist_category(
    args: UpdateChecklistCategoryArgs,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ChecklistCategory> {
    let category = state
        .checklist
        .update_category(&args.id, args.name, args.tone)?;
    emit_changed(&app, "category_updated", None);
    Ok(category)
}

#[tauri::command]
pub async fn delete_checklist_category(
    id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    state.checklist.delete_category(&id)?;
    emit_changed(&app, "category_deleted", None);
    Ok(())
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

#[tauri::command]
pub async fn get_linked_checklist_item(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<Option<ChecklistItem>> {
    state.checklist.open_item_for_session(&session_id)
}

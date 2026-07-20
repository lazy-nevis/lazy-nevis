use crate::demo::require_demo_active;
use crate::error::Result;
use crate::state::AppState;
use serde::Deserialize;
use tauri::{AppHandle, State};

#[derive(Debug, Deserialize)]
pub struct DemoAppearanceArgs {
    pub theme: String,
    pub locale: String,
}

#[derive(Debug, Deserialize)]
pub struct DemoNavigateArgs {
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct DemoSessionPoseArgs {
    pub pose: String,
}

#[derive(Debug, Deserialize)]
pub struct DemoShowWindowArgs {
    pub label: String,
    pub pane: Option<String>,
}

#[tauri::command]
pub async fn demo_is_active(state: State<'_, AppState>) -> Result<bool> {
    Ok(state.demo_active)
}

#[tauri::command]
pub async fn demo_apply_seed(state: State<'_, AppState>) -> Result<()> {
    require_demo_active(state.demo_active)?;
    crate::demo::apply_demo_seed(&state)
}

#[tauri::command]
pub async fn demo_set_appearance(
    args: DemoAppearanceArgs,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    require_demo_active(state.demo_active)?;
    crate::demo::catalog::apply_appearance(&app, &state, &args.theme, &args.locale)
}

#[tauri::command]
pub async fn demo_set_mode(mode: String, app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    require_demo_active(state.demo_active)?;
    crate::demo::catalog::apply_mode(&app, &state, &mode)
}

#[tauri::command]
pub async fn demo_navigate(
    args: DemoNavigateArgs,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    require_demo_active(state.demo_active)?;
    crate::demo::catalog::navigate_main(&app, &args.path).await
}

#[tauri::command]
pub async fn demo_set_session_pose(
    args: DemoSessionPoseArgs,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    require_demo_active(state.demo_active)?;
    let defaults = crate::demo::seed::pose_defaults_from_embedded();
    crate::demo::catalog::apply_session_pose(&app, &state, &args.pose, &defaults)
}

#[tauri::command]
pub async fn demo_show_window(
    args: DemoShowWindowArgs,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    require_demo_active(state.demo_active)?;
    crate::demo::catalog::show_window(&app, &args.label, args.pane.as_deref()).await
}

#[tauri::command]
pub async fn demo_settle(ms: Option<u64>, state: State<'_, AppState>) -> Result<()> {
    require_demo_active(state.demo_active)?;
    tokio::time::sleep(std::time::Duration::from_millis(ms.unwrap_or(500))).await;
    Ok(())
}

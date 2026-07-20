use crate::error::{AppError, Result};
use std::path::Path;
use tauri::{Manager, WebviewWindow};
use xcap::Window;

/// Capture the native window backing a Tauri webview into `out_path` (PNG).
pub fn capture_webview_window(window: &WebviewWindow, out_path: &Path) -> Result<(u32, u32)> {
    let _ = window.show();
    let _ = window.set_focus();

    let title = window.title().unwrap_or_default();
    let outer_position = window
        .outer_position()
        .map_err(|error| AppError::Internal(format!("window position: {error}")))?;
    let outer_size = window
        .outer_size()
        .map_err(|error| AppError::Internal(format!("window size: {error}")))?;

    let our_pid = std::process::id();
    let candidates = Window::all().map_err(|error| AppError::Internal(format!("xcap: {error}")))?;

    let mut best: Option<(i64, Window)> = None;
    for candidate in candidates {
        let pid = candidate.pid().unwrap_or(0);
        if pid != our_pid {
            continue;
        }
        if candidate.is_minimized().unwrap_or(true) {
            continue;
        }

        let score = match_score(
            &candidate,
            &title,
            outer_position.x,
            outer_position.y,
            outer_size.width,
            outer_size.height,
        );
        match &best {
            None => best = Some((score, candidate)),
            Some((best_score, _)) if score > *best_score => best = Some((score, candidate)),
            _ => {}
        }
    }

    let Some((_score, target)) = best else {
        return Err(AppError::NotFound(format!(
            "no capturable window for label={} title={title:?} pid={our_pid}",
            window.label()
        )));
    };

    let image = target
        .capture_image()
        .map_err(|error| AppError::Internal(format!("capture failed: {error}")))?;
    if let Some(parent) = out_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    image
        .save(out_path)
        .map_err(|error| AppError::Internal(format!("save png: {error}")))?;
    Ok((image.width(), image.height()))
}

fn match_score(
    window: &Window,
    expected_title: &str,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> i64 {
    let mut score = 0_i64;
    let title = window.title().unwrap_or_default();
    if !expected_title.is_empty() && title == expected_title {
        score += 1000;
    } else if !expected_title.is_empty()
        && (title.contains("LazyNevis") || expected_title.contains(&title))
    {
        score += 200;
    }

    let wx = window.x().unwrap_or(i32::MIN);
    let wy = window.y().unwrap_or(i32::MIN);
    let ww = window.width().unwrap_or(0);
    let wh = window.height().unwrap_or(0);
    let dx = (wx - x).abs() as i64;
    let dy = (wy - y).abs() as i64;
    let dw = (ww as i64 - width as i64).abs();
    let dh = (wh as i64 - height as i64).abs();
    score += 500 - (dx + dy + dw + dh).min(500);
    score
}

/// Hide non-target LazyNevis windows so captures stay clean.
pub fn hide_sibling_windows(app: &tauri::AppHandle, keep_label: &str) {
    for label in ["main", "overlay", "tray", "secondary"] {
        if label == keep_label {
            continue;
        }
        if let Some(window) = app.get_webview_window(label) {
            let _ = window.hide();
        }
    }
}

use crate::error::{AppError, Result};
use std::path::Path;
use std::time::Duration;
use tauri::{Manager, WebviewWindow};
use xcap::Window;

/// Capture the native window backing a Tauri webview into `out_path` (PNG).
///
/// On macOS, uses `screencapture -l` with the NSWindow number (never full-monitor
/// fallback — that grabbed the wrong Space / terminal under Mission Control).
pub fn capture_webview_window(window: &WebviewWindow, out_path: &Path) -> Result<(u32, u32)> {
    let _ = window.show();
    let _ = window.set_focus();

    let label = window.label().to_string();
    let mut title = window.title().unwrap_or_default();
    if title.trim().is_empty() {
        let fallback = format!("LazyNevis — {label}");
        let _ = window.set_title(&fallback);
        title = fallback;
        std::thread::sleep(Duration::from_millis(250));
    }

    let outer_position = window
        .outer_position()
        .map_err(|error| AppError::Internal(format!("window position: {error}")))?;
    let outer_size = window
        .outer_size()
        .map_err(|error| AppError::Internal(format!("window size: {error}")))?;

    #[cfg(target_os = "macos")]
    {
        if let Some(window_id) = macos_window_number(window) {
            match macos_screencapture(window_id, out_path, outer_size.width, outer_size.height) {
                Ok(dims) => return Ok(dims),
                Err(error) => {
                    tracing::warn!(
                        ?error,
                        window_id,
                        "screencapture -l failed; trying xcap fallback"
                    );
                }
            }
        }
    }

    capture_with_xcap(
        &title,
        outer_position.x,
        outer_position.y,
        outer_size.width,
        outer_size.height,
        out_path,
    )
}

#[cfg(target_os = "macos")]
fn macos_window_number(window: &WebviewWindow) -> Option<u32> {
    use objc2_app_kit::NSWindow;

    let ns_window_ptr = window.ns_window().ok()?;
    let ns_window = unsafe { &*(ns_window_ptr as *mut NSWindow) };
    let number = ns_window.windowNumber();
    if number <= 0 {
        None
    } else {
        Some(number as u32)
    }
}

#[cfg(target_os = "macos")]
fn macos_screencapture(
    window_id: u32,
    out_path: &Path,
    width: u32,
    height: u32,
) -> Result<(u32, u32)> {
    use std::process::Command;

    if let Some(parent) = out_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let path_str = out_path
        .to_str()
        .ok_or_else(|| AppError::Internal("non-utf8 screenshot path".into()))?;

    let status = Command::new("screencapture")
        .args(["-l", &window_id.to_string(), "-x", path_str])
        .status()
        .map_err(|error| AppError::Internal(format!("screencapture: {error}")))?;
    if !status.success() {
        return Err(AppError::Internal(format!(
            "screencapture -l {window_id} failed with {status}"
        )));
    }
    if !out_path.exists() {
        return Err(AppError::Internal(
            "screencapture reported success but wrote no file".into(),
        ));
    }
    Ok((width.max(1), height.max(1)))
}

fn capture_with_xcap(
    title: &str,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    out_path: &Path,
) -> Result<(u32, u32)> {
    let our_pid = std::process::id();
    let candidates = Window::all().map_err(|error| AppError::Internal(format!("xcap: {error}")))?;

    let mut scored: Vec<(i64, Window)> = candidates
        .into_iter()
        .filter(|candidate| candidate.pid().unwrap_or(0) == our_pid)
        .map(|candidate| {
            let score = match_score(&candidate, title, x, y, width, height);
            (score, candidate)
        })
        .collect();
    scored.sort_by_key(|entry| std::cmp::Reverse(entry.0));

    let ordered: Vec<Window> = {
        let mut preferred = Vec::new();
        let mut fallback = Vec::new();
        for (_score, window) in scored {
            if window.is_minimized().unwrap_or(false) {
                fallback.push(window);
            } else {
                preferred.push(window);
            }
        }
        preferred.extend(fallback);
        preferred
    };

    let mut last_error = None;
    for target in ordered {
        match target.capture_image() {
            Ok(image) => {
                if let Some(parent) = out_path.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                image
                    .save(out_path)
                    .map_err(|error| AppError::Internal(format!("save png: {error}")))?;
                return Ok((image.width(), image.height()));
            }
            Err(error) => last_error = Some(error.to_string()),
        }
    }

    Err(AppError::NotFound(format!(
        "no capturable window for title={title:?} pid={our_pid}{}",
        last_error
            .map(|error| format!(" (last error: {error})"))
            .unwrap_or_default()
    )))
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
    } else if expected_title.is_empty() && title.is_empty() {
        score += 150;
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
    score += ((ww as i64) * (wh as i64) / 100_000).min(300);
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

use crate::models::WindowInfo;
use std::time::Duration;
use tokio::time::sleep;

#[derive(Debug, Clone, serde::Serialize)]
pub struct WindowChangeEvent {
    pub window: WindowInfo,
    pub previous: Option<WindowInfo>,
    pub change_type: String, // "app_focus" | "title_change"
}

/// Poll the active window at the given interval and emit changes via callback.
/// Runs until `stop_rx` receives a signal.
pub async fn monitor_loop<F>(
    interval_ms: u64,
    micro_threshold_ms: u64,
    mut on_change: F,
    mut stop_rx: tokio::sync::oneshot::Receiver<()>,
) where
    F: FnMut(WindowChangeEvent) + Send + 'static,
{
    let mut last_window: Option<WindowInfo> = None;
    let mut last_change_time = std::time::Instant::now();

    loop {
        tokio::select! {
            _ = &mut stop_rx => break,
            _ = sleep(Duration::from_millis(interval_ms)) => {
                if let Some(current) = get_active_window() {
                    let elapsed = last_change_time.elapsed().as_millis() as u64;

                    if let Some(ref prev) = last_window {
                        let exe_changed = prev.app_exe != current.app_exe;
                        let title_changed = !exe_changed && prev.clean_title != current.clean_title;

                        if exe_changed || title_changed {
                            // Skip micro-events below threshold
                            if elapsed >= micro_threshold_ms || last_window.is_none() {
                                let change_type = if exe_changed {
                                    "app_focus"
                                } else {
                                    "title_change"
                                };

                                on_change(WindowChangeEvent {
                                    window: current.clone(),
                                    previous: last_window.clone(),
                                    change_type: change_type.to_string(),
                                });
                            }

                            last_change_time = std::time::Instant::now();
                            last_window = Some(current);
                        }
                    } else {
                        // First event
                        on_change(WindowChangeEvent {
                            window: current.clone(),
                            previous: None,
                            change_type: "app_focus".to_string(),
                        });
                        last_change_time = std::time::Instant::now();
                        last_window = Some(current);
                    }
                }
            }
        }
    }
}

/// Get the currently active window. Platform-specific implementation.
pub fn get_active_window() -> Option<WindowInfo> {
    #[cfg(target_os = "macos")]
    return get_active_window_macos();

    #[cfg(target_os = "windows")]
    return get_active_window_windows();

    #[cfg(target_os = "linux")]
    return get_active_window_linux();

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    return None;
}

#[cfg(target_os = "macos")]
fn get_active_window_macos() -> Option<WindowInfo> {
    use std::process::Command;

    let output = Command::new("osascript")
        .arg("-e")
        .arg(
            r#"
            tell application "System Events"
                set frontApp to first application process whose frontmost is true
                set appName to name of frontApp
                set appExe to name of frontApp
                try
                    set winTitle to name of front window of frontApp
                on error
                    set winTitle to ""
                end try
                return appName & "|" & appExe & "|" & winTitle
            end tell
        "#,
        )
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parts: Vec<&str> = stdout.trim().splitn(3, '|').collect();

    if parts.len() < 3 {
        return None;
    }

    Some(WindowInfo::new(
        parts[0].to_string(),
        parts[1].to_string(),
        parts[2].to_string(),
        None,
    ))
}

#[cfg(target_os = "windows")]
fn get_active_window_windows() -> Option<WindowInfo> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use windows::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
    };

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }

        let mut title_buf = [0u16; 512];
        let title_len = GetWindowTextW(hwnd, &mut title_buf);
        let title = OsString::from_wide(&title_buf[..title_len as usize])
            .to_string_lossy()
            .to_string();

        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));

        let process = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid).ok()?;

        let mut exe_buf = [0u16; 512];
        let exe_len = windows::Win32::System::ProcessStatus::GetModuleFileNameExW(
            Some(process),
            None,
            &mut exe_buf,
        );

        let exe_path = OsString::from_wide(&exe_buf[..exe_len as usize])
            .to_string_lossy()
            .to_string();

        let exe_name = std::path::Path::new(&exe_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        let app_name = exe_name.trim_end_matches(".exe").to_string();

        Some(WindowInfo::new(app_name, exe_name, title, Some(pid)))
    }
}

#[cfg(target_os = "linux")]
fn get_active_window_linux() -> Option<WindowInfo> {
    use std::process::Command;

    // Try xdotool first
    let id_output = Command::new("xdotool")
        .args(["getactivewindow"])
        .output()
        .ok()?;

    let window_id = String::from_utf8_lossy(&id_output.stdout)
        .trim()
        .to_string();

    let title_output = Command::new("xdotool")
        .args(["getwindowname", &window_id])
        .output()
        .ok()?;

    let title = String::from_utf8_lossy(&title_output.stdout)
        .trim()
        .to_string();

    let pid_output = Command::new("xdotool")
        .args(["getwindowpid", &window_id])
        .output()
        .ok()?;

    let pid: u32 = String::from_utf8_lossy(&pid_output.stdout)
        .trim()
        .parse()
        .ok()?;

    // Get process name from /proc
    let exe_path = std::fs::read_link(format!("/proc/{pid}/exe")).ok()?;
    let exe_name = exe_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    Some(WindowInfo::new(
        exe_name.clone(),
        exe_name,
        title,
        Some(pid),
    ))
}

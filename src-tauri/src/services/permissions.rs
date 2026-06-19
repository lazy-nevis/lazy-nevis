use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct PermissionsStatus {
    pub notifications: PermissionState,
    pub accessibility: PermissionState,
    pub platform: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PermissionState {
    #[cfg(target_os = "macos")]
    Granted,
    #[cfg(target_os = "macos")]
    Denied,
    NotDetermined,
    #[allow(dead_code)]
    NotRequired,
}

pub fn check_all() -> PermissionsStatus {
    PermissionsStatus {
        notifications: check_notifications(),
        accessibility: check_accessibility(),
        platform: std::env::consts::OS.to_string(),
    }
}

fn check_notifications() -> PermissionState {
    // Notification permission is managed by tauri-plugin-notification at runtime.
    // We mark it as NotDetermined so the frontend can request it separately.
    PermissionState::NotDetermined
}

fn check_accessibility() -> PermissionState {
    #[cfg(target_os = "macos")]
    return check_accessibility_macos();

    #[cfg(not(target_os = "macos"))]
    PermissionState::NotRequired
}

/// On macOS, check if the app has Automation permission for System Events.
/// This is required for window title monitoring via AppleScript.
#[cfg(target_os = "macos")]
fn check_accessibility_macos() -> PermissionState {
    use std::process::Command;

    // Try a simple System Events query. If it works, we have Automation permission.
    let result = Command::new("osascript")
        .arg("-e")
        .arg("tell application \"System Events\" to return name of first process whose frontmost is true")
        .output();

    match result {
        Ok(output) if output.status.success() => PermissionState::Granted,
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("not allowed") || stderr.contains("access") {
                PermissionState::Denied
            } else {
                PermissionState::NotDetermined
            }
        }
        Err(_) => PermissionState::NotDetermined,
    }
}

/// Open System Preferences to the correct privacy pane for the platform.
pub fn open_accessibility_prefs() {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        // macOS 13+: System Settings
        let _ = Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Automation")
            .spawn();
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        let _ = Command::new("cmd")
            .args(["/C", "start", "ms-settings:privacy-general"])
            .spawn();
    }
}

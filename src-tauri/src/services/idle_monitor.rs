/// Cross-platform idle time detection (time since last mouse/keyboard event).
/// No special OS permissions are required for any of these implementations.
pub fn get_idle_time_ms() -> u64 {
    #[cfg(target_os = "macos")]
    return get_idle_macos().unwrap_or(0);

    #[cfg(target_os = "windows")]
    return get_idle_windows().unwrap_or(0);

    #[cfg(target_os = "linux")]
    return get_idle_linux().unwrap_or(0);

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    return 0;
}

/// Returns true if the user has been idle for at least `threshold_ms` milliseconds.
#[cfg(test)]
pub fn is_idle(threshold_ms: u64) -> bool {
    get_idle_time_ms() >= threshold_ms
}

// ─── macOS ────────────────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
fn get_idle_macos() -> Option<u64> {
    use std::process::Command;

    // `ioreg` reads the IOHIDSystem service which reports HIDIdleTime in nanoseconds.
    // Available on all macOS versions, no Accessibility permission required.
    let output = Command::new("ioreg")
        .args(["-c", "IOHIDSystem", "-r", "-S"])
        .output()
        .ok()?;

    let text = String::from_utf8_lossy(&output.stdout);

    for line in text.lines() {
        if line.contains("HIDIdleTime") {
            if let Some(val_str) = line.split('=').nth(1) {
                if let Ok(ns) = val_str.trim().parse::<u64>() {
                    return Some(ns / 1_000_000); // nanoseconds → milliseconds
                }
            }
        }
    }
    None
}

// ─── Windows ──────────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn get_idle_windows() -> Option<u64> {
    use windows::Win32::System::SystemInformation::GetTickCount;
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

    unsafe {
        let mut lii = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };

        if GetLastInputInfo(&mut lii).as_bool() {
            let tick = GetTickCount();
            // tick wraps at u32::MAX (~49 days); safe for idle time which is always short
            let idle = tick.saturating_sub(lii.dwTime);
            return Some(idle as u64);
        }
    }
    None
}

// ─── Linux ────────────────────────────────────────────────────────────────────

#[cfg(target_os = "linux")]
fn get_idle_linux() -> Option<u64> {
    use std::process::Command;

    // xprintidle returns idle time in milliseconds
    if let Ok(out) = Command::new("xprintidle").output() {
        if out.status.success() {
            if let Ok(s) = String::from_utf8(out.stdout) {
                if let Ok(ms) = s.trim().parse::<u64>() {
                    return Some(ms);
                }
            }
        }
    }

    // Fallback: xssstate -i (xscreensaver idle state)
    if let Ok(out) = Command::new("xssstate").arg("-i").output() {
        if out.status.success() {
            if let Ok(s) = String::from_utf8(out.stdout) {
                if let Ok(ms) = s.trim().parse::<u64>() {
                    return Some(ms);
                }
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn idle_time_returns_value() {
        // Just verify it doesn't panic and returns a plausible value
        let idle = get_idle_time_ms();
        // We can't assert a specific value, but it should be non-panicking
        // and reasonably small (< 24h in ms = 86_400_000)
        assert!(idle < 86_400_000, "idle time unexpectedly large: {idle}ms");
    }

    #[test]
    fn is_idle_with_zero_threshold_is_always_true() {
        assert!(is_idle(0));
    }
}

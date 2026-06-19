use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WindowInfo {
    pub app_name: String,
    pub app_exe: String,
    pub window_title: String,
    pub clean_title: String,
    pub is_browser: bool,
    pub pid: Option<u32>,
}

impl WindowInfo {
    pub fn new(app_name: String, app_exe: String, window_title: String, pid: Option<u32>) -> Self {
        let is_browser = is_browser_exe(&app_exe);
        let clean_title = if is_browser {
            strip_browser_suffix(&window_title).to_string()
        } else {
            window_title.clone()
        };

        Self {
            app_name,
            app_exe,
            window_title,
            clean_title,
            is_browser,
            pid,
        }
    }
}

pub fn is_browser_exe(exe: &str) -> bool {
    let exe_lower = exe.to_lowercase();
    matches!(
        exe_lower.as_str(),
        "chrome"
            | "chrome.exe"
            | "chromium"
            | "chromium.exe"
            | "msedge"
            | "msedge.exe"
            | "firefox"
            | "firefox.exe"
            | "safari"
            | "brave"
            | "brave browser"
            | "brave.exe"
            | "arc"
            | "vivaldi"
            | "vivaldi.exe"
            | "opera"
            | "opera.exe"
    )
}

pub fn strip_browser_suffix(title: &str) -> &str {
    const SUFFIXES: &[&str] = &[
        " - Google Chrome",
        " - Chromium",
        " - Microsoft Edge",
        " \u{2014} Mozilla Firefox",
        " - Mozilla Firefox",
        " \u{2014} Safari",
        " - Safari",
        " - Brave",
        " \u{2014} Arc",
        " - Arc",
        " - Vivaldi",
        " - Opera",
    ];

    for suffix in SUFFIXES {
        if let Some(stripped) = title.strip_suffix(suffix) {
            return stripped;
        }
    }
    title
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_chrome_suffix() {
        assert_eq!(strip_browser_suffix("GitHub - Google Chrome"), "GitHub");
    }

    #[test]
    fn strips_firefox_suffix() {
        let title = "GitHub \u{2014} Mozilla Firefox";
        assert_eq!(strip_browser_suffix(title), "GitHub");
    }

    #[test]
    fn strips_edge_suffix() {
        assert_eq!(strip_browser_suffix("Docs - Microsoft Edge"), "Docs");
    }

    #[test]
    fn strips_brave_suffix() {
        assert_eq!(strip_browser_suffix("YouTube - Brave"), "YouTube");
    }

    #[test]
    fn strips_arc_suffix() {
        let title = "Notion \u{2014} Arc";
        assert_eq!(strip_browser_suffix(title), "Notion");
    }

    #[test]
    fn no_suffix_unchanged() {
        assert_eq!(strip_browser_suffix("VS Code"), "VS Code");
    }

    #[test]
    fn detects_browser_exes() {
        assert!(is_browser_exe("chrome.exe"));
        assert!(is_browser_exe("firefox.exe"));
        assert!(is_browser_exe("Safari"));
        assert!(!is_browser_exe("code.exe"));
    }
}

use crate::models::{settings::FocusRules, WindowInfo};

/// Apps that are never considered distractions regardless of rules.
/// Extend this array to permanently whitelist additional system processes.
pub const ALWAYS_IGNORED: &[&str] = &[
    "lazy-nevis",
    "lazynevis",
    "lazy_nevis",
    "LazyNevis",
    // System UI processes that should never be flagged
    "Finder",
    "Dock",
    "SystemUIServer",
    "loginwindow",
];

/// Background/system-chrome processes that never count as the user's "real"
/// focused app: LazyNevis itself, OS shell surfaces, and menu-bar/tray managers
/// (e.g. Thaw, Bartender). When one of these is frontmost the monitor keeps
/// attributing time to the previously focused app.
/// Spec: focus-rules/focus-transparent-apps.
pub const FOCUS_TRANSPARENT: &[&str] = &[
    // LazyNevis itself (tray popover, compact window, overlay)
    "lazy-nevis",
    "lazynevis",
    "lazy_nevis",
    // macOS system chrome
    "SystemUIServer",
    "Dock",
    "loginwindow",
    "NotificationCenter",
    "Notification Center",
    "ControlCenter",
    "Control Center",
    "Spotlight",
    "WindowManager",
    "Window Server",
    "screencaptureui",
    // macOS menu-bar/tray managers
    "Thaw",
    "Bartender",
    "Bartender 4",
    "Bartender 5",
    "Ice",
    "Hidden Bar",
    "Dozer",
    "Vanilla",
    // Windows shell surfaces
    "ShellExperienceHost",
    "StartMenuExperienceHost",
    "SearchHost",
    "SearchUI",
    "SearchApp",
    "TextInputHost",
    "LockApp",
    // Linux shells / panels
    "gnome-shell",
    "plasmashell",
    "xfce4-panel",
    "polybar",
    "waybar",
    "lxpanel",
    "mate-panel",
    "cinnamon",
];

/// Case-insensitive, `.exe`-insensitive process-name comparison.
fn process_name_matches(name: &str, candidate: &str) -> bool {
    let name = name.to_lowercase();
    let name = name.trim_end_matches(".exe");
    let candidate = candidate.to_lowercase();
    let candidate = candidate.trim_end_matches(".exe");
    name == candidate
}

/// True when the frontmost window belongs to a focus-transparent process and
/// should be skipped by the window monitor (previous app stays "current").
pub fn is_focus_transparent(window: &WindowInfo) -> bool {
    FOCUS_TRANSPARENT.iter().any(|&ignored| {
        process_name_matches(&window.app_exe, ignored)
            || process_name_matches(&window.app_name, ignored)
    })
}

/// True when the window matches a user-configured ignored app
/// (`focus_rules.ignored_apps` — spec: focus-rules/focus-transparent-apps).
pub fn is_user_ignored(window: &WindowInfo, ignored_apps: &[String]) -> bool {
    ignored_apps.iter().any(|ignored| {
        process_name_matches(&window.app_exe, ignored)
            || process_name_matches(&window.app_name, ignored)
    })
}

pub struct RuleEngine;

impl RuleEngine {
    /// Returns true if the given window is considered a distraction.
    pub fn is_distraction(rules: &FocusRules, window: &WindowInfo) -> bool {
        if is_always_ignored(&window.app_exe) || is_always_ignored(&window.app_name) {
            return false;
        }
        match rules.mode.as_str() {
            "allowlist" => !Self::is_in_allowlist(rules, window),
            "blocklist" => Self::is_in_blocklist(rules, window),
            _ => false,
        }
    }

    fn is_in_allowlist(rules: &FocusRules, window: &WindowInfo) -> bool {
        let exe_lower = window.app_exe.to_lowercase();
        let in_app_list = rules.apps.iter().any(|a| {
            a.to_lowercase() == exe_lower || a.to_lowercase() == window.app_name.to_lowercase()
        });

        if !in_app_list {
            return false;
        }

        // If the app is a browser that's in the allowlist, check tab rules too
        if window.is_browser {
            return Self::is_browser_tab_allowed(rules, &window.clean_title);
        }

        true
    }

    fn is_in_blocklist(rules: &FocusRules, window: &WindowInfo) -> bool {
        let exe_lower = window.app_exe.to_lowercase();
        let in_app_list = rules.apps.iter().any(|a| {
            a.to_lowercase() == exe_lower || a.to_lowercase() == window.app_name.to_lowercase()
        });

        if in_app_list {
            return true;
        }

        // If it's a browser not in the blocklist, still check tab rules
        if window.is_browser {
            return !Self::is_browser_tab_allowed(rules, &window.clean_title);
        }

        false
    }

    fn is_browser_tab_allowed(rules: &FocusRules, clean_title: &str) -> bool {
        let title_lower = clean_title.to_lowercase();
        match rules.browser_tab_mode.as_str() {
            "allowlist" => rules
                .browser_tab_terms
                .iter()
                .any(|term| title_lower.contains(&term.to_lowercase())),
            "blocklist" => !rules
                .browser_tab_terms
                .iter()
                .any(|term| title_lower.contains(&term.to_lowercase())),
            _ => true,
        }
    }
}

fn is_always_ignored(name: &str) -> bool {
    let lower = name.to_lowercase();
    let lower = lower.trim_end_matches(".exe");
    ALWAYS_IGNORED
        .iter()
        .any(|&ignored| lower == ignored.to_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{settings::FocusRules, WindowInfo};

    fn make_window(app_exe: &str, app_name: &str, is_browser: bool, title: &str) -> WindowInfo {
        WindowInfo {
            app_exe: app_exe.to_string(),
            app_name: app_name.to_string(),
            window_title: title.to_string(),
            clean_title: title.to_string(),
            is_browser,
            pid: None,
        }
    }

    fn allowlist_rules(apps: Vec<&str>) -> FocusRules {
        FocusRules {
            mode: "allowlist".to_string(),
            apps: apps.into_iter().map(String::from).collect(),
            browser_tab_mode: "blocklist".to_string(),
            browser_tab_terms: vec!["YouTube".to_string()],
            ..FocusRules::default()
        }
    }

    fn blocklist_rules(apps: Vec<&str>) -> FocusRules {
        FocusRules {
            mode: "blocklist".to_string(),
            apps: apps.into_iter().map(String::from).collect(),
            browser_tab_mode: "blocklist".to_string(),
            browser_tab_terms: vec!["YouTube".to_string()],
            ..FocusRules::default()
        }
    }

    #[test]
    fn allowlist_app_in_list_is_not_distraction() {
        let rules = allowlist_rules(vec!["code.exe"]);
        let window = make_window("code.exe", "Code", false, "main.rs — VS Code");
        assert!(!RuleEngine::is_distraction(&rules, &window));
    }

    #[test]
    fn allowlist_app_not_in_list_is_distraction() {
        let rules = allowlist_rules(vec!["code.exe"]);
        let window = make_window("slack.exe", "Slack", false, "Slack");
        assert!(RuleEngine::is_distraction(&rules, &window));
    }

    #[test]
    fn blocklist_app_in_list_is_distraction() {
        let rules = blocklist_rules(vec!["youtube.com", "chrome.exe"]);
        let window = make_window("chrome.exe", "Google Chrome", true, "YouTube");
        assert!(RuleEngine::is_distraction(&rules, &window));
    }

    #[test]
    fn blocklist_app_not_in_list_is_not_distraction() {
        let rules = blocklist_rules(vec!["instagram.com"]);
        let window = make_window("code.exe", "Code", false, "VS Code");
        assert!(!RuleEngine::is_distraction(&rules, &window));
    }

    #[test]
    fn browser_blocklist_tab_with_distraction_term_is_distraction() {
        let rules = blocklist_rules(vec![]);
        let window = make_window("chrome.exe", "Google Chrome", true, "YouTube - Watch");
        assert!(RuleEngine::is_distraction(&rules, &window));
    }

    #[test]
    fn browser_blocklist_tab_without_distraction_term_is_not_distraction() {
        let rules = blocklist_rules(vec![]);
        let window = make_window("chrome.exe", "Google Chrome", true, "GitHub - Pull Request");
        assert!(!RuleEngine::is_distraction(&rules, &window));
    }

    #[test]
    fn allowlist_browser_with_distraction_tab_is_distraction() {
        // Browser is in allowlist, but tab is a distraction (blocklist mode for tabs)
        let rules = FocusRules {
            mode: "allowlist".to_string(),
            apps: vec!["chrome.exe".to_string()],
            browser_tab_mode: "blocklist".to_string(),
            browser_tab_terms: vec!["YouTube".to_string()],
            ..FocusRules::default()
        };
        let window = make_window("chrome.exe", "Google Chrome", true, "YouTube - Watch Later");
        assert!(RuleEngine::is_distraction(&rules, &window));
    }

    #[test]
    fn allowlist_browser_with_focus_tab_is_not_distraction() {
        let rules = FocusRules {
            mode: "allowlist".to_string(),
            apps: vec!["chrome.exe".to_string()],
            browser_tab_mode: "blocklist".to_string(),
            browser_tab_terms: vec!["YouTube".to_string()],
            ..FocusRules::default()
        };
        let window = make_window("chrome.exe", "Google Chrome", true, "GitHub - Code Review");
        assert!(!RuleEngine::is_distraction(&rules, &window));
    }

    #[test]
    fn browser_allowlist_tab_mode_only_focus_terms_are_allowed() {
        let rules = FocusRules {
            mode: "blocklist".to_string(),
            apps: vec![],
            browser_tab_mode: "allowlist".to_string(),
            browser_tab_terms: vec!["docs.rust-lang.org".to_string(), "GitHub".to_string()],
            ..FocusRules::default()
        };
        // Tab matches allowlist → not a distraction
        let focus_win = make_window("firefox.exe", "Firefox", true, "GitHub - Pull Request");
        assert!(!RuleEngine::is_distraction(&rules, &focus_win));

        // Tab does NOT match allowlist → distraction
        let distract_win = make_window("firefox.exe", "Firefox", true, "Twitter");
        assert!(RuleEngine::is_distraction(&rules, &distract_win));
    }

    #[test]
    fn lazy_nevis_is_never_a_distraction() {
        // Even in strict allowlist mode with no apps listed, LazyNevis is never flagged
        let rules = allowlist_rules(vec![]);
        let window = make_window("lazy-nevis", "LazyNevis", false, "LazyNevis");
        assert!(!RuleEngine::is_distraction(&rules, &window));
    }

    #[test]
    fn lazy_nevis_exe_variant_is_never_a_distraction() {
        let rules = blocklist_rules(vec!["lazy-nevis"]);
        let window = make_window("lazy-nevis.exe", "LazyNevis", false, "LazyNevis");
        assert!(!RuleEngine::is_distraction(&rules, &window));
    }

    // Spec scenario: focus-rules/focus-transparent-apps
    #[test]
    fn tray_managers_and_lazy_nevis_are_focus_transparent() {
        for (exe, name) in [
            ("lazy-nevis", "LazyNevis"),
            ("Thaw", "Thaw"),
            ("bartender 5", "Bartender 5"),
            ("plasmashell", "plasmashell"),
            ("ShellExperienceHost.exe", "ShellExperienceHost"),
        ] {
            let window = make_window(exe, name, false, "");
            assert!(is_focus_transparent(&window), "{exe} should be transparent");
        }
    }

    #[test]
    fn real_apps_are_not_focus_transparent() {
        for (exe, name) in [
            ("code.exe", "Code"),
            ("chrome.exe", "Google Chrome"),
            ("Finder", "Finder"),
            ("explorer.exe", "Explorer"),
        ] {
            let window = make_window(exe, name, false, "");
            assert!(!is_focus_transparent(&window), "{exe} should be tracked");
        }
    }

    // Spec scenario: focus-rules/user-extendable-ignore-list
    #[test]
    fn user_ignored_apps_match_case_and_exe_insensitively() {
        let ignored = vec!["MyWidget".to_string(), "helper.exe".to_string()];
        assert!(is_user_ignored(
            &make_window("mywidget.exe", "MyWidget", false, ""),
            &ignored
        ));
        assert!(is_user_ignored(
            &make_window("Helper", "Helper", false, ""),
            &ignored
        ));
        assert!(!is_user_ignored(
            &make_window("code.exe", "Code", false, ""),
            &ignored
        ));
        assert!(!is_user_ignored(
            &make_window("code.exe", "Code", false, ""),
            &[]
        ));
    }
}

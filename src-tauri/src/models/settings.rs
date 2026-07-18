use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct GeneralSettings {
    pub language: String,
    pub theme: String,
    pub polling_interval_ms: u64,
    pub micro_event_threshold_ms: u64,
    pub start_minimized: bool,
    #[serde(default)]
    pub launch_at_login: bool,
    #[serde(default = "default_time_format")]
    pub time_format: String,
}

impl Default for GeneralSettings {
    fn default() -> Self {
        Self {
            language: "en-US".to_string(),
            theme: "system".to_string(),
            polling_interval_ms: 1000,
            micro_event_threshold_ms: 3000,
            start_minimized: false,
            launch_at_login: false,
            time_format: default_time_format(),
        }
    }
}

fn default_time_format() -> String {
    "24h".to_string()
}

#[cfg(test)]
mod general_settings_tests {
    use super::GeneralSettings;

    #[test]
    fn old_settings_default_launch_at_login_to_false() {
        let json = r#"{
            "language":"en-US",
            "theme":"system",
            "polling_interval_ms":1000,
            "micro_event_threshold_ms":3000,
            "start_minimized":false,
            "time_format":"24h"
        }"#;
        let settings: GeneralSettings = serde_json::from_str(json).unwrap();
        assert!(!settings.launch_at_login);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct FocusRules {
    pub mode: String, // "allowlist" | "blocklist"
    pub apps: Vec<String>,
    pub browser_tab_mode: String,
    pub browser_tab_terms: Vec<String>,
    /// User-added processes ignored by focus detection, on top of the built-in
    /// FOCUS_TRANSPARENT list (spec: focus-rules/focus-transparent-apps).
    pub ignored_apps: Vec<String>,
}

impl Default for FocusRules {
    fn default() -> Self {
        Self {
            mode: "blocklist".to_string(),
            apps: vec![],
            browser_tab_mode: "blocklist".to_string(),
            ignored_apps: vec![],
            browser_tab_terms: vec![
                "YouTube".to_string(),
                "Twitter".to_string(),
                "Instagram".to_string(),
                "Reddit".to_string(),
                "TikTok".to_string(),
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AlertSettings {
    pub notification_enabled: bool,
    pub notification_threshold_ms: u64,
    pub fullscreen_enabled: bool,
    pub fullscreen_threshold_ms: u64,
    pub cooldown_ms: u64,
    pub session_feedback_notifications: bool,
}

impl Default for AlertSettings {
    fn default() -> Self {
        Self {
            notification_enabled: true,
            notification_threshold_ms: 30_000,
            fullscreen_enabled: false,
            fullscreen_threshold_ms: 60_000,
            cooldown_ms: 10_000,
            session_feedback_notifications: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AudioSettings {
    pub notification_sound: String,
    pub fullscreen_sound: String,
    pub volume: f32,
    pub notification_sound_enabled: bool,
    pub fullscreen_sound_enabled: bool,
}

impl Default for AudioSettings {
    fn default() -> Self {
        Self {
            notification_sound: "builtin:alert1.wav".to_string(),
            fullscreen_sound: "builtin:alarm.wav".to_string(),
            volume: 0.8,
            notification_sound_enabled: true,
            fullscreen_sound_enabled: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct BreakSettings {
    pub enabled: bool,
    pub focus_interval_ms: u64,
    pub break_duration_ms: u64,
    pub alert_type: String,
}

impl Default for BreakSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            focus_interval_ms: 3_000_000, // 50 min
            break_duration_ms: 600_000,   // 10 min
            alert_type: "notification".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ShortcutSettings {
    pub toggle_focus: String,
    pub stop_session: String,
    pub open_home: String,
    pub add_checkpoint: String,
}

impl Default for ShortcutSettings {
    fn default() -> Self {
        // Triple-modifier combos minimize collisions with other apps' shortcuts
        // (spec: global-shortcuts/upgrade-preserves-bindings — existing users keep
        // their saved values; these apply to fresh installs only).
        Self {
            toggle_focus: "CmdOrCtrl+Alt+Shift+F".to_string(),
            stop_session: "CmdOrCtrl+Alt+Shift+S".to_string(),
            open_home: "CmdOrCtrl+Alt+Shift+O".to_string(),
            add_checkpoint: "CmdOrCtrl+Alt+Shift+C".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ChecklistSettings {
    /// Visual grace period after completing an item (spec: daily-checklist).
    pub grace_period_ms: u64,
    /// Last-used history sort: "created" | "due" | "completed".
    pub history_sort: String,
}

impl Default for ChecklistSettings {
    fn default() -> Self {
        Self {
            grace_period_ms: 10_000,
            history_sort: "created".to_string(),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct WindowGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Written exclusively by the backend mode/pin commands
/// (spec: settings-persistence/debounced-save-cannot-clobber-mode).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppModeSettings {
    pub mode: String, // "full" | "compact"
    pub pinned: bool,
    pub full_geometry: Option<WindowGeometry>,
    pub compact_geometry: Option<WindowGeometry>,
}

impl Default for AppModeSettings {
    fn default() -> Self {
        Self {
            mode: "full".to_string(),
            pinned: false,
            full_geometry: None,
            compact_geometry: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    #[serde(default)]
    pub general: GeneralSettings,
    #[serde(default)]
    pub focus_rules: FocusRules,
    #[serde(default)]
    pub alerts: AlertSettings,
    #[serde(default)]
    pub audio: AudioSettings,
    #[serde(default)]
    pub breaks: BreakSettings,
    #[serde(default)]
    pub shortcuts: ShortcutSettings,
    #[serde(default)]
    pub checklist: ChecklistSettings,
    #[serde(default)]
    pub app_mode: AppModeSettings,
}

impl AppSettings {
    pub fn validate(&self) -> crate::error::Result<()> {
        use crate::error::AppError;
        let invalid = |message: &str| AppError::InvalidArgument(message.to_string());
        if !matches!(self.general.language.as_str(), "en-US" | "pt-BR") {
            return Err(invalid("Unsupported language"));
        }
        if !matches!(self.general.theme.as_str(), "light" | "dark" | "system") {
            return Err(invalid("Unsupported theme"));
        }
        if !matches!(self.general.time_format.as_str(), "12h" | "24h") {
            return Err(invalid("Unsupported time format"));
        }
        if !(250..=60_000).contains(&self.general.polling_interval_ms) {
            return Err(invalid("Polling interval must be between 250 ms and 60 s"));
        }
        if self.general.micro_event_threshold_ms > 60_000 {
            return Err(invalid("Micro-event threshold cannot exceed 60 s"));
        }
        if !matches!(self.focus_rules.mode.as_str(), "allowlist" | "blocklist")
            || !matches!(
                self.focus_rules.browser_tab_mode.as_str(),
                "allowlist" | "blocklist"
            )
        {
            return Err(invalid("Focus rule mode must be allowlist or blocklist"));
        }
        if self.focus_rules.ignored_apps.len() > 1_000 {
            return Err(invalid("Too many ignored apps (max 1000)"));
        }
        if self
            .focus_rules
            .ignored_apps
            .iter()
            .any(|app| app.trim().is_empty() || app.len() > 255)
        {
            return Err(invalid(
                "Ignored app names must be non-empty and at most 255 characters",
            ));
        }
        if self.alerts.notification_threshold_ms < 1_000
            || self.alerts.fullscreen_threshold_ms < 1_000
            || self.alerts.cooldown_ms < 1_000
        {
            return Err(invalid("Alert durations must be at least one second"));
        }
        if !self.audio.volume.is_finite() || !(0.0..=1.0).contains(&self.audio.volume) {
            return Err(invalid("Audio volume must be between 0 and 1"));
        }
        if !(60_000..=43_200_000).contains(&self.breaks.focus_interval_ms)
            || !(60_000..=3_600_000).contains(&self.breaks.break_duration_ms)
            || !matches!(
                self.breaks.alert_type.as_str(),
                "notification" | "fullscreen"
            )
        {
            return Err(invalid("Invalid break settings"));
        }
        crate::services::shortcuts::parse_shortcuts(&self.shortcuts)?;
        if !(3_000..=60_000).contains(&self.checklist.grace_period_ms) {
            return Err(invalid(
                "Checklist grace period must be between 3 and 60 seconds",
            ));
        }
        if !matches!(
            self.checklist.history_sort.as_str(),
            "created" | "due" | "completed"
        ) {
            return Err(invalid("Invalid checklist history sort"));
        }
        if !matches!(self.app_mode.mode.as_str(), "full" | "compact") {
            return Err(invalid("Invalid app mode"));
        }
        for geometry in [self.app_mode.full_geometry, self.app_mode.compact_geometry]
            .into_iter()
            .flatten()
        {
            if !(200..=20_000).contains(&geometry.width)
                || !(200..=20_000).contains(&geometry.height)
            {
                return Err(invalid("Invalid stored window geometry"));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod app_settings_tests {
    use super::AppSettings;

    #[test]
    fn missing_groups_receive_compatible_defaults() {
        let settings: AppSettings =
            serde_json::from_str(r#"{"general":{"language":"pt-BR"}}"#).unwrap();

        assert_eq!(settings.general.language, "pt-BR");
        assert_eq!(settings.general.theme, "system");
        assert_eq!(settings.focus_rules.mode, "blocklist");
        assert_eq!(settings.audio.volume, 0.8);
        assert_eq!(settings.breaks.break_duration_ms, 600_000);
        assert!(!settings.shortcuts.toggle_focus.is_empty());
        settings.validate().unwrap();
    }

    #[test]
    fn all_settings_groups_round_trip() {
        let settings = AppSettings::default();
        let json = serde_json::to_string(&settings).unwrap();
        let restored: AppSettings = serde_json::from_str(&json).unwrap();

        assert_eq!(restored.general.language, settings.general.language);
        assert_eq!(restored.focus_rules.apps, settings.focus_rules.apps);
        assert_eq!(restored.alerts.cooldown_ms, settings.alerts.cooldown_ms);
        assert_eq!(restored.audio.volume, settings.audio.volume);
        assert_eq!(
            restored.breaks.focus_interval_ms,
            settings.breaks.focus_interval_ms
        );
        assert_eq!(restored.shortcuts.open_home, settings.shortcuts.open_home);
        restored.validate().unwrap();
    }

    #[test]
    fn rejects_invalid_values_from_every_settings_category() {
        let mut settings = AppSettings::default();
        settings.general.time_format = "invalid".into();
        assert!(settings.validate().is_err());

        let mut settings = AppSettings::default();
        settings.focus_rules.mode = "invalid".into();
        assert!(settings.validate().is_err());

        let mut settings = AppSettings::default();
        settings.alerts.cooldown_ms = 999;
        assert!(settings.validate().is_err());

        let mut settings = AppSettings::default();
        settings.audio.volume = f32::NAN;
        assert!(settings.validate().is_err());

        let mut settings = AppSettings::default();
        settings.breaks.break_duration_ms = 1;
        assert!(settings.validate().is_err());

        let mut settings = AppSettings::default();
        settings.shortcuts.open_home = "Escape".into();
        assert!(settings.validate().is_err());

        // Spec scenario: settings-persistence/out-of-range-value-rejected
        let mut settings = AppSettings::default();
        settings.checklist.grace_period_ms = 1_000;
        assert!(settings.validate().is_err());

        let mut settings = AppSettings::default();
        settings.checklist.history_sort = "invalid".into();
        assert!(settings.validate().is_err());
    }

    // Spec scenario: settings-persistence/upgrade-from-older-settings
    #[test]
    fn test_settings_upgrade_defaults_checklist_section() {
        let settings: AppSettings =
            serde_json::from_str(r#"{"general":{"language":"pt-BR"}}"#).unwrap();
        assert_eq!(settings.checklist.grace_period_ms, 10_000);
        assert_eq!(settings.checklist.history_sort, "created");
        settings.validate().unwrap();
    }
}

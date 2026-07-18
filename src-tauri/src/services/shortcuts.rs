use crate::error::{AppError, Result};
use crate::models::settings::ShortcutSettings;
use std::collections::{HashMap, HashSet};
use std::str::FromStr;
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};

pub const ACTIONS: [&str; 4] = [
    "toggle_focus",
    "stop_session",
    "open_home",
    "add_checkpoint",
];

const EVENTS: [&str; 4] = [
    "shortcut:toggle_focus",
    "shortcut:stop_session",
    "shortcut:open_home",
    "shortcut:add_checkpoint",
];

fn values(settings: &ShortcutSettings) -> [&str; 4] {
    [
        &settings.toggle_focus,
        &settings.stop_session,
        &settings.open_home,
        &settings.add_checkpoint,
    ]
}

/// One configured binding. `shortcut == None` means the binding is disabled (empty string).
#[derive(Debug, Clone, Copy)]
pub struct ParsedShortcut {
    pub action: &'static str,
    pub event: &'static str,
    pub shortcut: Option<Shortcut>,
}

/// Parse and validate bindings. Empty strings are valid and mean "disabled"
/// (spec: global-shortcuts/disable-one-shortcut). Parse/validation errors remain hard
/// errors so invalid settings are rejected before persisting.
pub fn parse_shortcuts(settings: &ShortcutSettings) -> Result<Vec<ParsedShortcut>> {
    let mut ids = HashSet::new();
    values(settings)
        .into_iter()
        .zip(ACTIONS.into_iter().zip(EVENTS))
        .map(|(value, (action, event))| {
            if value.trim().is_empty() {
                return Ok(ParsedShortcut {
                    action,
                    event,
                    shortcut: None,
                });
            }
            let shortcut = Shortcut::from_str(value).map_err(|error| {
                AppError::InvalidArgument(format!("Invalid shortcut '{value}': {error}"))
            })?;
            if shortcut.mods.is_empty() {
                return Err(AppError::InvalidArgument(format!(
                    "Shortcut '{value}' must include Ctrl/Cmd, Alt, or Shift"
                )));
            }
            if shortcut.key == Code::Escape {
                return Err(AppError::InvalidArgument(
                    "Escape is reserved for dismissing alerts".into(),
                ));
            }
            if !ids.insert(shortcut.id()) {
                return Err(AppError::InvalidArgument(format!(
                    "Shortcut '{value}' is assigned more than once"
                )));
            }
            Ok(ParsedShortcut {
                action,
                event,
                shortcut: Some(shortcut),
            })
        })
        .collect()
}

/// Best-effort registration: each binding registers independently; failures are collected
/// per action instead of aborting the whole set
/// (spec: global-shortcuts/os-conflict — one failure must not disable the others).
fn register_parsed<R: Runtime>(
    app: &AppHandle<R>,
    shortcuts: &[ParsedShortcut],
) -> HashMap<String, String> {
    let mut errors = HashMap::new();
    for parsed in shortcuts {
        let Some(shortcut) = parsed.shortcut else {
            continue; // disabled
        };
        if app.global_shortcut().is_registered(shortcut) {
            continue;
        }
        let event_name = parsed.event.to_string();
        if let Err(error) = app
            .global_shortcut()
            .on_shortcut(shortcut, move |app, _, event| {
                if event.state == ShortcutState::Pressed {
                    let _ = app.emit(&event_name, ());
                }
            })
        {
            errors.insert(parsed.action.to_string(), error.to_string());
        }
    }
    errors
}

/// Register all configured shortcuts, returning per-action registration errors
/// (empty map = everything registered).
pub fn register_shortcuts<R: Runtime>(
    app: &AppHandle<R>,
    settings: &ShortcutSettings,
) -> Result<HashMap<String, String>> {
    let shortcuts = parse_shortcuts(settings)?;
    Ok(register_parsed(app, &shortcuts))
}

/// Swap registrations when settings change: unregister the previous set, then register the
/// next set best-effort. Returns the per-action error map for the new set.
pub fn replace_shortcuts<R: Runtime>(
    app: &AppHandle<R>,
    previous: &ShortcutSettings,
    next: &ShortcutSettings,
) -> Result<HashMap<String, String>> {
    let previous = parse_shortcuts(previous)?;
    let next = parse_shortcuts(next)?;
    for parsed in &previous {
        let Some(shortcut) = parsed.shortcut else {
            continue;
        };
        if app.global_shortcut().is_registered(shortcut) {
            if let Err(error) = app.global_shortcut().unregister(shortcut) {
                tracing::warn!(
                    ?error,
                    action = parsed.action,
                    "failed to unregister shortcut"
                );
            }
        }
    }
    Ok(register_parsed(app, &next))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_defaults() {
        let parsed = parse_shortcuts(&ShortcutSettings::default()).unwrap();
        assert_eq!(parsed.len(), 4);
        assert!(parsed.iter().all(|p| p.shortcut.is_some()));
    }

    // Spec scenario: global-shortcuts/disable-one-shortcut
    #[test]
    fn test_shortcut_disable_empty_binding_is_valid_and_skipped() {
        let settings = ShortcutSettings {
            toggle_focus: "".into(),
            ..ShortcutSettings::default()
        };
        let parsed = parse_shortcuts(&settings).unwrap();
        assert_eq!(parsed.len(), 4);
        assert!(parsed[0].shortcut.is_none());
        assert_eq!(parsed[0].action, "toggle_focus");
        assert!(parsed[1..].iter().all(|p| p.shortcut.is_some()));
    }

    #[test]
    fn rejects_malformed_modifier_free_duplicate_and_escape() {
        let mut settings = ShortcutSettings {
            toggle_focus: "not-a-shortcut".into(),
            ..ShortcutSettings::default()
        };
        assert!(parse_shortcuts(&settings).is_err());
        settings.toggle_focus = "KeyF".into();
        assert!(parse_shortcuts(&settings).is_err());
        settings.toggle_focus = settings.stop_session.clone();
        assert!(parse_shortcuts(&settings).is_err());
        settings.toggle_focus = "CmdOrCtrl+Escape".into();
        assert!(parse_shortcuts(&settings).is_err());
    }

    // Spec scenario: global-shortcuts/upgrade-preserves-bindings — the new defaults are
    // triple-modifier combos and must parse.
    #[test]
    fn new_defaults_use_triple_modifiers() {
        let defaults = ShortcutSettings::default();
        for value in [
            &defaults.toggle_focus,
            &defaults.stop_session,
            &defaults.open_home,
            &defaults.add_checkpoint,
        ] {
            assert!(value.contains("Alt"), "{value} should include Alt");
        }
        parse_shortcuts(&defaults).unwrap();
    }
}

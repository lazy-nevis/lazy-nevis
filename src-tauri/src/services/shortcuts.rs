use crate::error::{AppError, Result};
use crate::models::settings::ShortcutSettings;
use std::collections::HashSet;
use std::str::FromStr;
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};

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

pub fn parse_shortcuts(settings: &ShortcutSettings) -> Result<Vec<Shortcut>> {
    let mut ids = HashSet::new();
    values(settings)
        .into_iter()
        .map(|value| {
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
            Ok(shortcut)
        })
        .collect()
}

fn register_parsed<R: Runtime>(app: &AppHandle<R>, shortcuts: &[Shortcut]) -> Result<()> {
    let mut registered_now = Vec::new();
    for (shortcut, event_name) in shortcuts.iter().copied().zip(EVENTS) {
        if app.global_shortcut().is_registered(shortcut) {
            continue;
        }
        let event_name = event_name.to_string();
        if let Err(error) = app
            .global_shortcut()
            .on_shortcut(shortcut, move |app, _, event| {
                if event.state == ShortcutState::Pressed {
                    let _ = app.emit(&event_name, ());
                }
            })
        {
            for registered in registered_now {
                let _ = app.global_shortcut().unregister(registered);
            }
            return Err(AppError::InvalidArgument(format!(
                "Could not register shortcut: {error}"
            )));
        }
        registered_now.push(shortcut);
    }
    Ok(())
}

pub fn register_shortcuts<R: Runtime>(
    app: &AppHandle<R>,
    settings: &ShortcutSettings,
) -> Result<()> {
    let shortcuts = parse_shortcuts(settings)?;
    register_parsed(app, &shortcuts)
}

pub fn replace_shortcuts<R: Runtime>(
    app: &AppHandle<R>,
    previous: &ShortcutSettings,
    next: &ShortcutSettings,
) -> Result<()> {
    let previous = parse_shortcuts(previous)?;
    let next = parse_shortcuts(next)?;
    for shortcut in &previous {
        if app.global_shortcut().is_registered(*shortcut) {
            if let Err(error) = app.global_shortcut().unregister(*shortcut) {
                let _ = register_parsed(app, &previous);
                return Err(AppError::Internal(error.to_string()));
            }
        }
    }
    if let Err(error) = register_parsed(app, &next) {
        if let Err(restore_error) = register_parsed(app, &previous) {
            tracing::error!(?restore_error, "failed to restore previous shortcuts");
        }
        return Err(error);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_defaults() {
        assert_eq!(
            parse_shortcuts(&ShortcutSettings::default()).unwrap().len(),
            4
        );
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
}

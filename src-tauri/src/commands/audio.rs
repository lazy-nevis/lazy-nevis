use crate::error::{AppError, Result};
use crate::services::audio_player::resolve_sound_path;
use crate::state::AppState;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

#[tauri::command]
pub async fn play_sound(
    source: String,
    volume: f32,
    looping: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    if !volume.is_finite() || !(0.0..=1.0).contains(&volume) {
        return Err(AppError::InvalidArgument(
            "Volume must be between 0 and 1".into(),
        ));
    }
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let path = resolve_sound_path(&source, &resource_dir)?;

    let is_playing_flag = {
        let audio = state
            .audio
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        audio.play_file(&path, volume, looping)?;
        audio.is_playing_flag()
    };

    // For non-looping sounds, watch for completion and emit audio:finished
    if !looping {
        tokio::spawn(async move {
            // Give rodio a moment to load and start playing
            tokio::time::sleep(Duration::from_millis(300)).await;
            // Poll until done (max 10 min safety)
            let mut elapsed_ms = 0u64;
            loop {
                tokio::time::sleep(Duration::from_millis(150)).await;
                elapsed_ms += 150;
                if !is_playing_flag.load(Ordering::Acquire) || elapsed_ms > 600_000 {
                    let _ = app.emit("audio:finished", ());
                    break;
                }
            }
        });
    }

    Ok(())
}

#[tauri::command]
pub async fn stop_sound(state: State<'_, AppState>) -> Result<()> {
    let audio = state
        .audio
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    audio.stop();
    Ok(())
}

#[tauri::command]
pub async fn list_builtin_sounds(app: AppHandle) -> Result<Vec<String>> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    for sounds_dir in [resource_dir.join("sounds"), resource_dir.clone()] {
        if !sounds_dir.exists() {
            continue;
        }
        let Ok(entries) = std::fs::read_dir(&sounds_dir) else {
            continue;
        };

        let mut names: Vec<String> = entries
            .flatten()
            .filter_map(|e| {
                let path = e.path();
                let ext = path.extension()?.to_str()?.to_lowercase();
                if !matches!(ext.as_str(), "mp3" | "wav" | "ogg") {
                    return None;
                }
                let name = path.file_name()?.to_str()?;
                Some(format!("builtin:{name}"))
            })
            .collect();

        if !names.is_empty() {
            names.sort();
            return Ok(names);
        }
    }
    Ok(vec![])
}

/// Get the list of recently used audio files (max 10, newest first).
#[tauri::command]
pub async fn get_recent_audio_files(state: State<'_, AppState>) -> Result<Vec<RecentAudioFile>> {
    let db = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    let mut stmt = db
        .conn()
        .prepare(crate::db::queries::SELECT_RECENT_AUDIO)
        .map_err(AppError::Database)?;

    let files = stmt
        .query_map([], |row| {
            Ok(RecentAudioFile {
                path: row.get(0)?,
                label: row.get(1)?,
                added_at: row.get(2)?,
            })
        })
        .map_err(AppError::Database)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    Ok(files)
}

/// Add a file to the recent audio list (evicts the oldest when > 10).
#[tauri::command]
pub async fn add_recent_audio_file(
    path: String,
    label: String,
    state: State<'_, AppState>,
) -> Result<()> {
    let audio_path = std::path::Path::new(&path);
    let extension = audio_path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase);
    if !audio_path.is_absolute()
        || !audio_path.is_file()
        || !matches!(extension.as_deref(), Some("mp3" | "wav" | "ogg"))
        || label.trim().is_empty()
        || label.len() > 255
    {
        return Err(AppError::InvalidArgument(
            "Audio must be an existing absolute MP3, WAV, or OGG path".into(),
        ));
    }
    let db = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    let now = crate::state::now_ms();

    db.conn()
        .execute(
            crate::db::queries::UPSERT_RECENT_AUDIO,
            rusqlite::params![path, label, now],
        )
        .map_err(AppError::Database)?;

    // Keep only the 10 most recent
    db.conn()
        .execute(crate::db::queries::TRIM_RECENT_AUDIO, [])
        .map_err(AppError::Database)?;

    Ok(())
}

#[derive(Debug, serde::Serialize, Clone)]
pub struct RecentAudioFile {
    pub path: String,
    pub label: String,
    pub added_at: i64,
}

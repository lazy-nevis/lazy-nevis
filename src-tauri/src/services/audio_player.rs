use crate::error::{AppError, Result};
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc::{self, Sender},
    Arc,
};

enum AudioCmd {
    Play {
        path: PathBuf,
        volume: f32,
        looping: bool,
    },
    Stop,
}

/// Send-safe audio player backed by a dedicated OS thread.
pub struct AudioPlayer {
    tx: Sender<AudioCmd>,
    /// True while a sound is playing (updated by the background thread).
    is_playing: Arc<AtomicBool>,
}

impl AudioPlayer {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::channel::<AudioCmd>();
        let is_playing = Arc::new(AtomicBool::new(false));
        let is_playing_bg = Arc::clone(&is_playing);

        std::thread::spawn(move || {
            use rodio::{Decoder, DeviceSinkBuilder, Player, Source};
            use std::io::BufReader;

            // (handle, player, is_looping) — keep both alive while playing
            let mut active: Option<(rodio::MixerDeviceSink, Player, bool)> = None;

            loop {
                // Poll with a 150ms timeout so we can detect when non-looping sounds end
                match rx.recv_timeout(std::time::Duration::from_millis(150)) {
                    Ok(cmd) => match cmd {
                        AudioCmd::Stop => {
                            if let Some((_, ref player, _)) = active {
                                player.stop();
                            }
                            active = None;
                            is_playing_bg.store(false, Ordering::Release);
                        }

                        AudioCmd::Play {
                            path,
                            volume,
                            looping,
                        } => {
                            if let Some((_, ref player, _)) = active {
                                player.stop();
                            }
                            active = None;
                            is_playing_bg.store(false, Ordering::Release);

                            let Ok(handle) = DeviceSinkBuilder::open_default_sink() else {
                                tracing::error!("audio: failed to open output stream");
                                continue;
                            };
                            let player = Player::connect_new(handle.mixer());
                            player.set_volume(volume.clamp(0.0, 1.0));

                            let Ok(file) = std::fs::File::open(&path) else {
                                tracing::error!("audio: configured file is unavailable");
                                continue;
                            };
                            let Ok(source) = Decoder::new(BufReader::new(file)) else {
                                tracing::error!("audio: configured file could not be decoded");
                                continue;
                            };

                            if looping {
                                player.append(source.repeat_infinite());
                            } else {
                                player.append(source);
                            }

                            is_playing_bg.store(true, Ordering::Release);
                            active = Some((handle, player, looping));
                            tracing::debug!(looping, "audio playback started");
                        }
                    },

                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        // Detect non-looping sound completion
                        if let Some((_, ref player, looping)) = active {
                            if !looping && player.empty() {
                                tracing::debug!("audio: non-looping sound finished");
                                is_playing_bg.store(false, Ordering::Release);
                                active = None;
                            }
                        }
                    }

                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
        });

        Self { tx, is_playing }
    }

    pub fn play_file(&self, path: &Path, volume: f32, looping: bool) -> Result<()> {
        self.tx
            .send(AudioCmd::Play {
                path: path.to_path_buf(),
                volume,
                looping,
            })
            .map_err(|_| AppError::Audio("audio thread closed".into()))
    }

    pub fn stop(&self) {
        let _ = self.tx.send(AudioCmd::Stop);
    }

    /// Clone of the `is_playing` flag for external polling.
    pub fn is_playing_flag(&self) -> Arc<AtomicBool> {
        Arc::clone(&self.is_playing)
    }
}

impl Default for AudioPlayer {
    fn default() -> Self {
        Self::new()
    }
}

/// Resolve a sound source to an absolute path.
pub fn resolve_sound_path(source: &str, resource_dir: &Path) -> Result<PathBuf> {
    if let Some(name) = source.strip_prefix("builtin:") {
        let builtin = Path::new(name);
        let extension = builtin.extension().and_then(|value| value.to_str());
        if builtin.file_name().and_then(|value| value.to_str()) != Some(name)
            || !matches!(extension, Some("mp3" | "wav" | "ogg"))
        {
            return Err(AppError::InvalidArgument(
                "invalid built-in audio name".into(),
            ));
        }
        for candidate in [
            resource_dir.join("sounds").join(name),
            resource_dir.join(name),
        ] {
            if candidate.is_file() {
                return Ok(candidate);
            }
        }
        // Walk up to find src-tauri/sounds (dev fallback)
        let mut dir = resource_dir.to_path_buf();
        for _ in 0..6 {
            for sub in ["src-tauri/sounds", "sounds"] {
                let candidate = dir.join(sub).join(name);
                if candidate.is_file() {
                    return Ok(candidate);
                }
            }
            if !dir.pop() {
                break;
            }
        }
        tracing::error!("audio: built-in resource was not found");
        return Err(AppError::NotFound(format!(
            "builtin sound '{name}' not found"
        )));
    }

    let path = Path::new(source).canonicalize().map_err(AppError::Io)?;
    if !path.is_file() {
        return Err(AppError::InvalidArgument(
            "audio source must be a file".into(),
        ));
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !matches!(ext.as_str(), "mp3" | "wav" | "ogg") {
        return Err(AppError::InvalidArgument(
            "unsupported audio format; use mp3, wav, or ogg".into(),
        ));
    }
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::resolve_sound_path;

    #[test]
    fn rejects_builtin_path_traversal_and_unsupported_custom_files() {
        let directory = tempfile::tempdir().unwrap();
        assert!(resolve_sound_path("builtin:../secret.wav", directory.path()).is_err());
        let text = directory.path().join("sound.txt");
        std::fs::write(&text, b"not audio").unwrap();
        assert!(resolve_sound_path(text.to_str().unwrap(), directory.path()).is_err());
    }
}

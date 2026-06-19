# Application Threat Model

## Assets

LazyNevis stores session timing, application names and executable labels, window titles, checkpoint/notes text, settings, focus rules, runtime heartbeats, and recent custom-audio paths. JSON/CSV exports contain user-selected copies of this data. Custom audio files remain outside app ownership.

## Boundaries And Mitigations

- A compromised main WebView could invoke allowlisted commands, so Rust validates settings, shortcut syntax, audio paths, and identifiers. External opening is restricted to explicit HTTPS URLs.
- The overlay WebView receives alert content and can invoke application commands, but its Tauri capability excludes opener, shell, dialog, store, notification, and global-shortcut permissions. Escape registration is owned by Rust.
- The app-data directory is user-private. Unix permissions are tightened to `0700` for the directory and `0600` for SQLite. OS account compromise and privileged malware remain out of scope.
- Activity data is not logged at info level and is never included in update checks. The manual check contacts only the official GitHub API with bounded response size and time.
- Export is an explicit trust-boundary crossing. The UI warns about sensitive titles/text, and CSV output escapes cells and neutralizes spreadsheet formulas.

## Failure Posture

Database initialization never overwrites an existing file. Invalid serialized settings are copied to a timestamped backup record before defaults are restored. Session recovery pauses after interruption instead of attributing an unobserved gap. Update metadata is never executed or automatically downloaded.

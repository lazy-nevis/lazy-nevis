# Privacy

LazyNevis is local-first. It stores settings, focus rules, session timing, active application/window labels, checkpoints, and recent audio-file paths in the operating system application-data directory. Custom audio files remain where the user selected them.

The application has no telemetry, advertising, accounts, cloud synchronization, or automatic updater. The About page offers an explicit manual update check that requests only public release metadata from `api.github.com/repos/simstm/lazy-nevis`. It sends no settings, session, window, or activity data. GitHub may receive ordinary network metadata such as the user's IP address. Results are cached for 15 minutes, and the app never downloads or executes an update.

JSON/CSV exports are created only at the user's request and may contain application/window titles and checkpoint text. Users control where exports go and should inspect them before sharing. Settings provides data deletion; uninstalling may leave application data behind, as documented in [installation](docs/release/installation.md). Deleting the application-data directory removes local LazyNevis records but not exported files or custom audio.

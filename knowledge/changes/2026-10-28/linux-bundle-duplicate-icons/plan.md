# Plan

1. Replace the recursive icon glob in `src-tauri/tauri.conf.json` with explicit entries for
   `icons/icon.icns` and `icons/icon.png`, keeping their `icons/` destination.
2. Update the historical comment in `src-tauri/src/services/app_status.rs`.
3. Validate with the standard suites and the CI Linux/macOS/Windows smoke builds.

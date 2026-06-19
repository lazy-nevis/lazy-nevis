# Backend Architecture

`src-tauri/src/lib.rs` configures Tauri, app state, tray, shortcuts, windows, plugins, and command registration. Commands are IPC adapters returning `Result<T, AppError>`; services own session logging, classification, window/idle monitoring, permissions, and audio. `monitor.rs` coordinates the one-second runtime loop and alert checks.

Shared state is synchronized for spawned tasks. OS-specific code is target-gated. Native resources and sounds ship through Tauri bundling. Rust unit tests cover deterministic services; `tests/e2e_critical.rs` covers cross-module persistence behavior.

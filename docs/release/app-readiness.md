# Application Release Readiness

## Reproducible Baseline

Validated locally on macOS 26.5 (25F71) with Bun 1.3.13, Rust 1.95.0, Cargo 1.95.0, and Tauri CLI 2.11.2. Pinned versions live in `.bun-version` and `rust-toolchain.toml`. Run the complete local gate with `bun run quality`; production packaging remains `bun run tauri build`.

## Feature Evidence Matrix

| Public surface | Automated evidence | Manual artifact check |
|---|---|---|
| Session controls, recovery, timing | hook/store/session logger/state tests | sleep/wake and forced termination |
| Rules, alerts, cooldown | rule engine and ticker boundary tests | native notification and overlay |
| Break lifecycle | state/store/ticker and session tests | reminder, skip, manual/automatic end |
| Configurable shortcuts | parser/conflict tests and settings failure test | OS registration/conflict on each platform |
| History/export/delete | session logger and CSV escaping tests | native save/cancel and large history |
| Audio and permissions | service tests/build coverage | device audio and OS permission dialogs |
| Themes, languages, accessibility | locale/static checks and component tests | 200%, reduced motion, high contrast, 640x480 |
| Version/update/donation | version contract, update and About tests | offline check and approved URLs |
| Tray and autostart | Rust build/integration contracts | clean login and tray menus |

## External Acceptance Record

For each exact RC/stable artifact, record OS version, architecture, artifact SHA-256, signature status, first launch, permissions, tray, shortcuts, audio, autostart, sleep/wake, uninstall, reinstall, and known limitations. Required targets are macOS ARM64, Windows x64, Windows ARM64, Ubuntu/Debian, and one RPM-family distribution. These entries cannot be marked passed from source-level automation or from a different artifact.

RC publication, the stable observation period, signing identities, and clean-machine results remain owner/external gates described in `docs/plans/03-EXECUTION-GUIDE-AND-MANUAL-ACTIONS.md`.

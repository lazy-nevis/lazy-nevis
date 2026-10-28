# Linux bundle: duplicate icon resources

## Problem

After the Tauri bump (CLI 2.12.4), `tauri build --bundles rpm` fails with
"invalid destination path /usr/lib/LazyNevis/icons/ic_launcher.png - duplicate file entry".
The `"icons/**/*": "icons/"` resource glob flattens every subdirectory into `icons/`, so the
five Android `mipmap-*/ic_launcher.png` files (and other same-named mobile icons) collide.

## Requirement

- Bundle only the icon resources read at runtime by path: `icons/icon.icns` and
  `icons/icon.png` (macOS notification icon lookup in `services/notifications.rs`).
- Tray icons stay embedded with `include_bytes!`; no runtime behavior changes.
- AppImage, deb and rpm bundles build on Linux.

## Second failure: rpm rejects pre-release versions

With the duplicate fixed, rpm bundling fails with `invalid version "0.10.0-rc.5"`. Tauri CLI
2.12.x bundles `rpm` 0.30, which rejects `-` in versions (upstream fix pending in
tauri-apps/tauri#16336). Requirement: keep `@tauri-apps/cli` pinned to 2.11.2 (last known-good
on `main`) and stop Dependabot from bumping it until the upstream fix ships. The CLI is not part
of Tauri's crate/npm mismatch check, so the runtime packages can stay on 2.12.

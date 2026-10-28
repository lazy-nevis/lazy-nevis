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

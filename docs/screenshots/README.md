# Release Screenshot Set

Real screenshots must come from the tagged release candidate and contain no personal window
titles, paths, or history. Capture at 1440×900 or higher and crop consistently.

## Automation

```bash
# Release path: build once, then run against that binary
bun run tauri build
bun run screenshots

# Optional: point at a specific binary
# export LAZYNEVIS_BIN="/path/to/LazyNevis.app/Contents/MacOS/lazy-nevis"

# Dev path: starts \`bun run tauri dev\` (Vite + app). Demo paths go via
# LAZYNEVIS_* env (CLI args after \`tauri dev --\` break \`cargo run\`).
# Close any existing \`tauri dev\` first (port 1420).
bun run screenshots:dev
# or: bun run screenshots -- --use-dev
```

The orchestrator launches:

```text
LazyNevis --screenshot-demo \
  --data-dir <isolated> \
  --catalog scripts/screenshots/catalog.json \
  --out scripts/screenshots/out/<version>-<platform>
```

Output for the site/docs consumer:

```text
out/<version>-<platform>/
  manifest.json
  dashboard-running-dark.png
  …
```

Drop the folder into the marketing project and map assets by `manifest.shots[].id` / `tags`
(no hardcoded paths required).

| Path | Role |
|---|---|
| [`scripts/screenshots/catalog.json`](../../scripts/screenshots/catalog.json) | Shot catalog |
| [`scripts/screenshots/schemas/`](../../scripts/screenshots/schemas/) | Catalog + manifest JSON Schema |
| [`scripts/screenshots/seed/demo-seed.json`](../../scripts/screenshots/seed/demo-seed.json) | Fictional seed |
| [`scripts/screenshots/run.ts`](../../scripts/screenshots/run.ts) | Bun launcher |
| OpenSpec | [`openspec/changes/2026-07-screenshot-automation/`](../../openspec/changes/2026-07-screenshot-automation/) |

**macOS notes**

- Window capture uses `screencapture -l` (Screen Recording permission may be required).
- Keep LazyNevis on the **current desktop** — avoid Mission Control / Stage Manager covering the
  app while shots run. Do not leave the terminal fullscreen over the capture Space.
- Overlay shots use a floating (non-screensaver) window so capture APIs can see them.

## Expected filenames (priority set)

- `dashboard-idle-light.png` / `dashboard-idle-dark.png`
- `dashboard-running-light.png` / `dashboard-running-dark.png`
- `history-light.png` / `history-dark.png`
- `settings-light.png` / `settings-dark.png`
- `notification-alert.png` / `fullscreen-alert.png`

Optional catalog entries: checklist, about, compact mode, tray panel, secondary settings.

## Manual fallback

Before publishing curated README embeds, human-review the automated PNGs, then copy approved
files into this directory if desired. Images are intentionally not fabricated before the RC UI
is available.

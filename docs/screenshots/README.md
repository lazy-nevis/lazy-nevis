# Release Screenshot Set

Real screenshots must come from the tagged release candidate and contain no personal window
titles, paths, or history. Capture at 1440×900 or higher and crop consistently.

## Automation

```bash
# 1) Build the app
bun run tauri build

# 2) Optional: point at a specific binary
# export LAZYNEVIS_BIN="/path/to/LazyNevis.app/Contents/MacOS/lazy-nevis"

# 3) Run the catalog (isolated data dir + manifest)
bun run screenshots
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

**macOS note:** window capture via `xcap` may require Screen Recording permission for the terminal
or the LazyNevis binary in System Settings → Privacy & Security.

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

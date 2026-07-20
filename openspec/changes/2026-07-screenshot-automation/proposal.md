# Proposal: Release Screenshot Automation

## What

A gated **screenshot demo mode** plus a declarative **catalog/orchestrator** that:

- Seeds non-personal demo data into an isolated app data directory.
- Poses known UI states (routes, themes, session states, overlay/tray/compact/secondary).
- Captures standardized PNGs from the **compiled** LazyNevis binary.
- Emits a **`manifest.json`** mapping each image to screen/feature/state metadata for docs and the marketing site.

## Why

Release docs and the future site need real RC UI screenshots (`docs/screenshots/README.md`), not mockups. Manual capture is slow, OS-inconsistent, and risks personal window titles/history. A catalog-driven pipeline makes assets reproducible per version on macOS, Linux, and Windows in a clean profile.

## Affected capability specs

- **New capability:** `screenshot-automation`.
- No deltas to product session/settings capabilities beyond demo-only command registration and optional data-dir override used exclusively when the demo gate is active.

## Consequences

- **Privacy:** Demo seed must contain only fictional app names and content; normal user data dirs are never used when the gate + isolated dir are set.
- **Security:** Demo pose/capture commands SHALL no-op or error unless the demo gate is active.
- **Offline:** Unchanged for normal use; screenshot runs are local.
- **Release:** Screenshot artifacts are produced from RC/stable binaries; they are not substitutes for product QA.
- **Platform:** Capture adapters may differ per OS; the catalog and manifest schemas stay shared.

## Alternatives considered

- **Frontend-only Playwright against Vite:** rejected for marketing — omits native chrome, tray, overlay windows; conflicts with “real application output” policy.
- **WebDriver (`tauri-driver`) as sole driver:** deferred — useful later for E2E assertions; weak for multi-window marketing captures and macOS coverage.
- **Pure OS click scripts without demo poses:** rejected — flaky timing and no reliable session/history state.

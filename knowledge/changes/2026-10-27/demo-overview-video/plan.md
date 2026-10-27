---
type: concept
title: demo-overview-video — plan
description: Implementation plan for the 16:9 frame, demo recordings and overview video.
tags: [change, plan, demo, screenshots, video]
---

# Plan — demo-overview-video

- Change `SHOT_FULL_SIZE` in `src-tauri/src/demo/catalog.rs` to 1920×1080.
- Update `knowledge/product/capabilities/screenshot-automation.md` and
  `docs/screenshots/README.md` for the new frame.
- Rerun `bun run screenshots:dev`, review the contact sheet, commit the PNGs.
- Launch `bun run dev:demo --fresh`, resize the main window to 1920×1080, and record short
  clips of navigation and motion with the screen recorder.
- Build the video with the 21st video tools: scenes for intro, each screen area and a close,
  using the screenshots and clips as uploaded assets; check snapshots; export 1080p.

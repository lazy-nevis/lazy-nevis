---
type: Playbook
title: Rust and Tauri boundaries
description: Hard ownership rules for backend monitoring, SQL, audio, and self-ignore.
tags: [agents, rules, rust, tauri]
---

# Rust and Tauri boundaries

- Do keep Rust commands thin and return `Result<T, AppError>`; put business logic in `src-tauri/src/services/`.
- Do put new SQL constants in `src-tauri/src/db/queries.rs` (do not expand inline SQL debt).
- Do check alert thresholds in the 1-second ticker in `src-tauri/src/monitor.rs`, not only on window changes.
- Do run time-based triggers (reminders, habit schedules, pomodoro) in the always-on scheduler ticker (`start_scheduler_ticker` in `monitor.rs`), independent of focus sessions.
- Do keep `rodio::OutputStream` inside the audio background OS thread.
- Do keep LazyNevis in `ALWAYS_IGNORED` in the rule engine.
- Do register new commands in `src-tauri/src/lib.rs` `generate_handler!`.
- Do not add new production `unwrap()`/`expect()` paths when a `Result` path fits.
- See also: `RTK.md`, `knowledge/product/capabilities/focus-sessions.md`, `knowledge/product/capabilities/alerts-and-cooldown.md`

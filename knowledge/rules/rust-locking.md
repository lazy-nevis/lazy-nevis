---
type: Playbook
title: Rust lock discipline
description: Avoid self-deadlocks and lock-order inversions around the shared Database mutex and the scheduler.
tags: [agents, rules, rust, concurrency]
---

# Rust lock discipline

`std::sync::Mutex` is **not re-entrant**: locking it twice on the same thread hangs forever (the app freezes; `cargo test` hangs silently).

- Do not hold a `Database` guard (`lock_db()`, `db.lock()`) while calling another service method that locks the DB again (`self.get`, `self.list`, `self.get_log`, …). Scope the guard/transaction in a `{ … }` block or `drop(db)` first, then call the method.
- Lock order is **scheduler → db** (the scheduler ticker holds the scheduler while reading the DB). Never call `mark_dirty()` or anything that locks the scheduler while holding the DB guard.
- Pomodoro: `active` → `db` only; never take `active` while holding `db`.
- Prefer temporary guards for single statements: `self.lock_db()?.conn().execute(…)`.
- If `cargo test` "hangs", suspect a re-entrant lock first. Run cargo by full path (`~/.cargo/bin/cargo`) so wrappers don't hide output.
- See also: [`rust-and-tauri-boundaries.md`](./rust-and-tauri-boundaries.md)

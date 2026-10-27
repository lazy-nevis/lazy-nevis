# Focus sessions

## Purpose

Track at most one local focus session at a time: start, pause, resume, checkpoint, stop; accumulate focus / distraction / idle while active; persist history locally.

## Invariants

- At most one active session.
- Paused time does not count toward elapsed focus/distraction/idle.
- Accounting and persistence work offline (no network dependency for core session flow).
- Crash-safe recovery: runtime snapshots / heartbeat; after unexpected restart the session can be recovered paused (see session-recovery capability).
- Frontend session hook registration is single: `useFocusSession()` only in `AppShell`.

## Normative capabilities

- `knowledge/product/capabilities/focus-sessions.md`
- `knowledge/product/capabilities/session-recovery.md`
- `knowledge/product/capabilities/break-lifecycle.md`

## Implementation pointers

- Monitor ticker: `src-tauri/src/monitor.rs`
- Session services / commands under `src-tauri/src/services/` and `src-tauri/src/commands/`
- Frontend: `src/hooks/useFocusSession`, `src/stores/` session store
- Live detail: `RTK.md`

## Open questions

- None recorded beyond existing capability scenarios.

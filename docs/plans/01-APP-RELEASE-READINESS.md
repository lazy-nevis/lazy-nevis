# LazyNevis App Release Readiness Plan

Status: proposed  
Target: `v0.1.0-rc.1`, followed by `v0.1.0` after validation  
Scope owner: application behavior, quality, security boundaries, and end-user experience

## Purpose

This plan turns the current MVP into a release candidate that is safe to distribute to real users. It covers known incomplete behavior, defects found during the readiness audit, quality gates, platform validation, and release acceptance criteria.

It does not configure GitHub governance, write community documentation, or publish packages. Those tasks are defined in [02-OPEN-SOURCE-RELEASE-AND-DISTRIBUTION.md](02-OPEN-SOURCE-RELEASE-AND-DISTRIBUTION.md).

## Ground Rules For Implementing Agents

- Read `RTK.md` and the relevant OpenSpec capability before changing code.
- Work from a dedicated branch and declare the task IDs being implemented.
- Do not combine unrelated cleanup with a task.
- Preserve user changes and never rewrite history without authorization.
- Add tests for every behavior change and keep both locale files aligned.
- Update `RTK.md` only after behavior is verified.
- Do not mark an item complete based only on compilation.
- AI-authored commits must include the required `Co-Authored-By` trailer.

## Priorities And Release Gates

- **P0**: required before publishing `v0.1.0-rc.1`.
- **P1**: required before promoting the release candidate to `v0.1.0` unless explicitly deferred with a documented reason.
- **P2**: valuable post-`0.1.0` work that must not delay the first stable release.

The release candidate may be published only when all P0 acceptance criteria pass. Stable `v0.1.0` requires all P0 tasks, the selected P1 tasks, and a completed cross-platform validation cycle.

## Phase 0 - Baseline And Reproducibility

### APP-001 - Establish a clean baseline [P0]

- [ ] Record exact Bun, Rust, Cargo, operating system, and Tauri CLI versions used for validation.
- [ ] Run the existing frontend tests, frontend build, Rust tests, Cargo formatting check, and Clippy.
- [ ] Fix the current Clippy failure in `src-tauri/src/services/idle_monitor.rs`.
- [ ] Add scripts or documented commands for the complete local quality gate.
- [ ] Store the results in the pull request, not as permanent generated output in the repository.

Acceptance criteria:

- `bun run test` passes.
- `bun run build` passes.
- `cargo test --manifest-path src-tauri/Cargo.toml` passes.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` passes.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` passes.

### APP-002 - Define one version source and release semantics [P0]

- [ ] Decide which file is authoritative for the application version.
- [ ] Add a version synchronization/check script for `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, and release metadata.
- [ ] Replace the hardcoded version in `src/pages/About.tsx` with the runtime Tauri application version.
- [ ] Define SemVer handling for `0.1.0-rc.N`, `0.1.0`, patch releases, and prereleases.
- [ ] Repair the incorrect historical `0.1.0` changelog entry before creating the first public tag.

Acceptance criteria:

- CI fails if version-bearing files disagree.
- The About page shows the packaged application version.
- No public tag exists for a version described as unreleased.

## Phase 1 - Complete Advertised Features

### APP-101 - Apply configurable global shortcuts [P0]

- [ ] Move shortcut parsing and registration into a testable Rust service.
- [ ] Load persisted shortcut settings before registering shortcuts at startup.
- [ ] Re-register shortcuts when settings change without restarting the app.
- [ ] Validate malformed shortcuts, duplicates, reserved combinations, and registration conflicts.
- [ ] Keep the overlay `Esc` shortcut independent from configurable user shortcuts.
- [ ] Return actionable errors to the frontend and retain the previous valid registration if an update fails.
- [ ] Add Rust tests for parsing/conflicts and frontend tests for success and failure feedback.

Acceptance criteria:

- Every shortcut displayed in Settings controls the matching action.
- Changes take effect immediately and survive restart.
- A failed registration never leaves all shortcuts silently disabled.

### APP-102 - Finish the break lifecycle [P0]

- [ ] Specify reminder, start, active countdown, skip, end, and resume behavior.
- [ ] Connect `break:reminder` to a visible frontend action.
- [ ] Call the existing `start_break` and `end_break` commands from the intended UI flow.
- [ ] Define whether session time pauses during breaks and apply the rule consistently to statistics.
- [ ] Prevent duplicate reminders and duplicate break timers.
- [ ] Restore or safely terminate break state after app restart or sleep.
- [ ] Record break events consistently in the timeline and exports.
- [ ] Add tests for manual end, automatic end, restart, pause interaction, and disabled reminders.

Acceptance criteria:

- The Pomodoro preset works from reminder through completed break.
- Break time cannot be counted simultaneously as focus or distraction.
- Timeline, live UI, history, and persisted state agree.

### APP-103 - Verify every advertised feature [P0]

- [ ] Build a feature-to-test matrix from README claims and `RTK.md`.
- [ ] Exercise tray actions, autostart, session controls, recovery, rules, alerts, audio, permissions, history, export, data reset, themes, and languages.
- [ ] Remove or qualify documentation claims that are not true on every supported platform.
- [ ] Create issues for P2 limitations rather than silently presenting them as complete.

Acceptance criteria:

- Every public feature claim has an automated test, a manual platform test, or an explicit limitation.

## Phase 2 - Data Integrity And Backend Robustness

### APP-201 - Remove production panics [P0]

- [ ] Audit `unwrap()`, `expect()`, `panic!`, `todo!`, and poisoned mutex handling outside test modules.
- [ ] Replace fallible startup operations with contextual `AppError` results or controlled fatal-error UI/logging.
- [ ] Make tray/icon failures non-fatal where the app can continue safely.
- [ ] Ensure database initialization errors do not corrupt or overwrite user data.
- [ ] Test failure paths using invalid directories, locked databases, malformed settings, and missing resources.

Acceptance criteria:

- No avoidable production panic remains in application-owned code.
- Startup failures provide a useful diagnostic without destroying existing data.

### APP-202 - Complete database migrations and SQL ownership [P0]

- [ ] Add `recent_audio_files` through a numbered migration instead of lazy table creation.
- [ ] Move remaining application SQL into `src-tauri/src/db/queries.rs` or migration files.
- [ ] Make migrations transactional, ordered, and idempotent.
- [ ] Test upgrade from the original schema, current development schema, and a partially initialized database.
- [ ] Document the database location and backup procedure.
- [ ] Confirm cascade/delete behavior for sessions, events, checkpoints, and runtime state.

Acceptance criteria:

- A database created by any pre-release build upgrades without data loss.
- Fresh installation and upgrade produce the same final schema.

### APP-203 - Harden settings persistence [P1]

- [ ] Validate numeric ranges and cross-field constraints in Rust, not only in the UI.
- [ ] Preserve defaults for fields absent from older serialized settings.
- [ ] Handle malformed settings with backup and recovery rather than silent deletion.
- [ ] Ensure debounced saves are flushed or safely reconciled when closing the app.
- [ ] Add round-trip and migration tests for all settings groups.

### APP-204 - Validate session timing and recovery edge cases [P0]

- [ ] Test sleep/wake, clock changes, long ticker gaps, app crashes, forced termination, and multiple rapid commands.
- [ ] Prevent overlapping monitor tasks or duplicate Tauri listeners.
- [ ] Verify focus percentage semantics including idle time and document them.
- [ ] Validate pause/resume and recovered-session behavior with timeline boundaries.
- [ ] Add concurrency tests for start/stop/pause/checkpoint races where practical.

Acceptance criteria:

- No known sequence creates two active sessions, negative durations, or double-counted time.

## Phase 3 - Frontend Quality And Accessibility

### APP-301 - Complete internationalization [P0]

- [ ] Replace all hardcoded user-visible strings in pages, charts, tooltips, placeholders, hints, accessibility labels, and error messages.
- [ ] Add an automated locale-key parity test.
- [ ] Add a static check or lint rule that flags likely hardcoded JSX strings.
- [ ] Verify date, time, duration, decimal, and plural formatting in both locales.
- [ ] Test the independent overlay WebView in both languages.

Acceptance criteria:

- English and Portuguese locale trees have identical keys.
- Switching language updates all visible application surfaces without restart.

### APP-302 - Improve accessible interaction [P1]

- [ ] Add accessible names to icon-only controls and status indicators.
- [ ] Verify focus order, visible focus, keyboard operation, modal focus trapping, and escape behavior.
- [ ] Avoid conveying focus/distraction state by color alone.
- [ ] Test 200% scaling, reduced motion, high contrast, and the minimum 640x480 window.
- [ ] Add focused component tests for critical accessible behavior.

### APP-303 - Standardize error and loading states [P1]

- [ ] Define user-facing errors for permissions, database, audio, export, shortcut, and network failures.
- [ ] Avoid empty catch blocks for operations users need to know failed.
- [ ] Prevent duplicate toasts and stale loading indicators.
- [ ] Ensure destructive actions remain disabled while executing.

### APP-304 - Review visual and responsive behavior [P1]

- [ ] Validate Dashboard, History, Settings, About, modals, charts, and overlay at supported window sizes.
- [ ] Check long translations, long app names, long labels, empty data, and large histories.
- [ ] Capture final screenshots for both themes and supported languages.

## Phase 4 - Security And Privacy Boundaries

### APP-401 - Minimize Tauri capabilities [P0]

- [ ] Split capabilities for `main` and `overlay` windows.
- [ ] Remove shell, dialog, store, notification, and shortcut permissions from the overlay unless demonstrably required.
- [ ] Prefer the narrower opener capability for approved external HTTPS links.
- [ ] Scope external URLs to an explicit allowlist where supported.
- [ ] Review every registered command for least privilege and validate untrusted string/path inputs.
- [ ] Add a short threat model for WebView compromise, local file access, and command invocation.

Acceptance criteria:

- The overlay can only perform actions required to display and dismiss an alert.
- External links cannot invoke arbitrary schemes or local executables.

### APP-402 - Protect sensitive local data [P0]

- [ ] Inventory stored fields, including window titles, app names, paths, settings, and exported data.
- [ ] Remove sensitive values from production logs or redact them consistently.
- [ ] Confirm database and settings files use user-private locations and reasonable filesystem permissions.
- [ ] Warn users that exports can contain window titles and application activity.
- [ ] Test complete data deletion, including runtime state and recent audio history.

### APP-403 - Add safe release update checking [P1]

- [ ] Implement an explicit manual check and decide whether background checks are opt-in.
- [ ] Fetch only the minimal latest-release metadata from the official repository endpoint.
- [ ] Use timeouts, response size limits, caching, semantic version comparison, and graceful offline behavior.
- [ ] Ignore drafts and handle prereleases according to the user's selected channel.
- [ ] Show current version and available version in About; use a compact sidebar indicator only when an update exists.
- [ ] Open the official release page instead of implementing auto-update.
- [ ] Update privacy claims because the app will no longer have literally zero network calls.
- [ ] Add mocked tests for current, newer, prerelease, malformed, rate-limited, timeout, and offline responses.

Acceptance criteria:

- A failed update check never blocks startup or creates repeated notifications.
- No browsing or activity data is sent with the request.

### APP-404 - Add the donation link safely [P1]

- [ ] Add a localized Buy Me a Coffee button to About using the approved external URL.
- [ ] Use a normal link/button rather than embedded remote JavaScript.
- [ ] Add the domain to the explicit external-link allowlist.
- [ ] Verify the app remains fully usable without network access.

## Phase 5 - Automated And Manual Testing

### APP-501 - Replace the placeholder E2E suite [P0]

- [ ] Move integration tests into a location actually discovered by the chosen runner.
- [ ] Remove ignored `todo!()` placeholders from claimed test coverage.
- [ ] Choose deterministic Tauri WebDriver coverage only where the platform supports it.
- [ ] Add lower-level Rust integration tests for flows that cannot be reliably automated through WebDriver.
- [ ] Cover start/pause/resume/stop, persistence, recovery, alert cooldown, breaks, shortcuts, and destructive data actions.
- [ ] Make CI fail when the required integration suite does not execute any tests.

### APP-502 - Expand frontend tests [P0]

- [ ] Test About version/update/donation states.
- [ ] Test break reminder and lifecycle UI.
- [ ] Test shortcut registration feedback.
- [ ] Test History filters, empty/error states, and export escaping.
- [ ] Test listener registration cleanup and ensure `useFocusSession()` remains single-instance.

### APP-503 - Expand Rust service tests [P0]

- [ ] Add tests for shortcut parsing/registration decisions.
- [ ] Add alert threshold and cooldown boundary tests in the ticker.
- [ ] Add break-state and timing tests.
- [ ] Add migration and corrupted-settings recovery tests.
- [ ] Add update-version comparison tests if comparison lives in Rust.

### APP-504 - Perform platform acceptance tests [P0 for RC, repeated for stable]

- [ ] Test a clean macOS ARM64 machine with no development tools.
- [ ] Test clean Windows x64 and Windows ARM64 machines or representative VMs/devices.
- [ ] Test clean Ubuntu/Debian and one RPM-family distribution.
- [ ] Test first launch, permissions, tray, shortcuts, audio, autostart, sleep/wake, uninstall, and reinstall.
- [ ] Verify packaged assets and database paths, not development paths.
- [ ] Record OS versions, artifact checksums, results, and known limitations.

## Phase 6 - Release Candidate Acceptance

### APP-601 - Run the release candidate gate [P0]

- [ ] Confirm all P0 tasks are complete.
- [ ] Confirm CI passes from a clean checkout with locked dependencies.
- [ ] Confirm application versions are synchronized as `0.1.0-rc.1`.
- [ ] Confirm no placeholder, fake test, stale claim, or draft feature is presented as complete.
- [ ] Confirm database upgrade and rollback/backup instructions.
- [ ] Confirm privacy and security documentation matches actual behavior.
- [ ] Publish the RC as a GitHub prerelease only after the distribution plan is ready.

### APP-602 - Promote to stable [P1]

- [ ] Collect RC feedback for an agreed observation period.
- [ ] Resolve release-blocking crash, data-loss, security, install, and core-workflow issues.
- [ ] Rebuild from the stable tag rather than renaming RC files.
- [ ] Repeat platform smoke tests on the exact stable artifacts.
- [ ] Publish known limitations and defer non-blocking work to the roadmap.

## Required Validation Commands

```bash
/Users/lucas/.bun/bin/bun install --frozen-lockfile
/Users/lucas/.bun/bin/bun run test
/Users/lucas/.bun/bin/bun run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
/Users/lucas/.bun/bin/bun run tauri build
```

Platform-specific build and signing commands belong to the distribution plan.

## Definition Of Done

The application plan is complete when:

- All P0 items are implemented and verified.
- Selected P1 items are either complete or explicitly documented as stable-release exceptions.
- Automated tests exercise real behavior and contain no claimed placeholder E2E coverage.
- Clean-machine acceptance tests pass for every published artifact.
- Product claims, privacy statements, version metadata, and actual behavior agree.
- `RTK.md`, OpenSpec capability specs, and the changelog reflect the verified implementation.

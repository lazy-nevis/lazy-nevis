# Contributing to LazyNevis

Thank you for taking the time to contribute. Every bug report, documentation fix, and code change makes LazyNevis better for everyone. By participating, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Ways to contribute

- **Report a bug** — open an issue using the Bug Report template.
- **Suggest a feature** — open an issue using the Feature Request template.
- **Improve documentation** — fix a typo, expand a guide, or add a missing example.
- **Fix a bug** — look for issues labeled `good first issue` or `bug`.
- **Add a feature** — discuss substantial new features in an issue before writing code.

For usage questions, please use [Discussions](https://github.com/lazy-nevis/lazy-nevis/discussions) rather than issues.

---

## Before you start

1. Read `README.md` and `RTK.md` to understand the project.
2. Read the relevant `openspec/specs/*/spec.md` if your change touches a defined capability.
3. Check existing issues and pull requests — your idea may already be in progress.
4. For substantial features, open an issue first so we can align on approach before you spend time on implementation.

---

## Setting up the development environment

**Prerequisites:**

- [Bun](https://bun.sh/) (package manager and script runner)
- Stable Rust (install via [rustup](https://rustup.rs/))
- [Tauri v2 system dependencies](https://v2.tauri.app/start/prerequisites/) for your OS

**Steps:**

```bash
git clone https://github.com/lazy-nevis/lazy-nevis.git
cd lazy-nevis
bun install --frozen-lockfile
bun run tauri dev
```

If `bun` is not on your PATH, use the full path to your Bun binary (e.g. `~/.bun/bin/bun`).

The dev server starts at `http://localhost:1420` with hot-reload. The Tauri window opens automatically.

---

## Project layout

```
src/                     React + TypeScript frontend
  App.tsx                Router and AppShell
  components/
    ui/                  Custom base components (no shadcn dependency)
    features/            Domain widgets: alerts, permissions, timeline, session modal
    charts/              Pure SVG charts
    layout/              Sidebar, toast container
  pages/                 Dashboard, History, Settings, About, Overlay
  hooks/                 useFocusSession, useSettings
  stores/                Zustand stores (session, settings, UI)
  services/tauri.ts      All frontend invoke() wrappers
  types/index.ts         TypeScript mirror of Rust payloads and models
  i18n/locales/          en-US.json, pt-BR.json

src-tauri/src/           Rust backend
  lib.rs                 Tauri setup, tray, shortcuts, command registry
  monitor.rs             Session ticker, alert checks, window-change handler
  state.rs               AppState and SessionData
  commands/              Thin Tauri command handlers
  services/              Business logic: monitor, rule engine, session logger, audio, permissions
  models/                Serde structs mirrored in src/types/index.ts
  db/                    Database wrapper, migrations, SQL query constants
```

---

## Code rules

### TypeScript

- TypeScript is in strict mode. Do not add `any`.
- Use `t("section.key")` for all user-visible strings. Never hardcode strings that users will see.
- Add every new key to **both** `src/i18n/locales/en-US.json` and `src/i18n/locales/pt-BR.json`.
- Use `@/` imports for source files.
- Do not call `useFocusSession()` outside `AppShell`.

### Rust

- Keep Tauri command handlers thin. Push business logic into `src-tauri/src/services/`.
- New SQL constants go in `src-tauri/src/db/queries.rs`. Do not add inline SQL elsewhere.
- Keep alert threshold logic in the ticker in `src-tauri/src/monitor.rs`.
- Keep `rodio::OutputStream` inside the audio background thread; do not put it in shared app state.
- Prefer `Result<T, AppError>` over panics in production paths.

### New Tauri commands

When adding a new Tauri command:

1. Create the handler in `src-tauri/src/commands/`.
2. Register it in `src-tauri/src/lib.rs` `generate_handler!`.
3. Add a wrapper function in `src/services/tauri.ts`.
4. Add or update TypeScript types in `src/types/index.ts`.

---

## OpenSpec requirement

Features, behavior changes, schema changes, and cross-module refactors require an OpenSpec proposal before implementation begins.

Read [docs/contributing/openspec.md](docs/contributing/openspec.md) for the full workflow. The short version:

1. Create `openspec/changes/YYYY-MM-description/proposal.md`.
2. Wait for maintainer approval.
3. Implement, update the relevant spec, archive.

Docs-only, test-only, dependency-only, and trivial behavior-preserving fixes may claim the PR exemption.

---

## Branch naming

Use one of these prefixes:

| Prefix | Use for |
|---|---|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation changes |
| `test/` | Test additions or fixes |
| `refactor/` | Code restructuring without behavior change |
| `build/` | Build system changes |
| `ci/` | CI workflow changes |
| `chore/` | Maintenance (dependency bumps, config) |

Example: `feat/break-snooze` or `fix/overlay-dismiss`.

---

## Commit format

LazyNevis uses [Conventional Commits](https://www.conventionalcommits.org/). Every commit message must start with a type:

```
feat: add snooze option to break reminders
fix: prevent overlay from blocking ESC after dismiss
docs: expand macOS installation guide
refactor: extract rule engine from monitor module
ci: add ARM64 build target for Windows
```

Keep commits focused. Do not include generated build output, lock file changes unrelated to your work, or secrets.

---

## Validating before opening a PR

Run all of these and make sure they pass:

```bash
bun run test
bun run build
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features --locked -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --locked
bun run quality
```

---

## Opening a pull request

A good PR description includes:

- **What changed and why** — a concise summary of the change and the problem it solves.
- **Linked issue** — reference the issue this closes (e.g., `Closes #42`).
- **OpenSpec reference or exemption** — either `OpenSpec: openspec/changes/YYYY-MM-description` or `OpenSpec exemption: <reason>`.
- **What you tested** — platforms you ran it on, scenarios you verified manually.
- **What you did not test** — honest gaps, so reviewers know where to focus.
- **Screenshots** for visual changes.

---

## Opening an issue

Use the Issue Forms:

- Bug Report
- Feature Request
- Documentation

Security vulnerabilities should not be reported in public issues. See [SECURITY.md](SECURITY.md) for the private disclosure process.

---

## Review process

After you open a PR:

- A maintainer will review it, usually within a few days.
- CI must pass: frontend tests, frontend build, Rust tests, Clippy, and format checks.
- Reviewers may request changes to scope, code style, or spec alignment.
- Resolved conversations and at least one maintainer approval are required before merge.
- Squash merge is used; make sure your squash title is a valid Conventional Commit.

---

## Getting help

- Usage questions and troubleshooting: [GitHub Discussions](https://github.com/lazy-nevis/lazy-nevis/discussions).
- Reproducible defects: use the Bug Report issue form; remove private window titles or paths from logs.
- Vulnerabilities: report privately according to [SECURITY.md](SECURITY.md), never in a public issue.

---

## Governance

LazyNevis is maintainer-led. `@simstm` has final authority over roadmap, merges, security response, releases, signing identities, and repository access. Reviews seek technical consensus, but maintenance capacity, privacy, safety, and product scope may decide an outcome.

Contributors retain authorship of their work under the project license. Material decisions should be visible in issues, OpenSpec changes, or ADRs. If sustained participation grows, governance may evolve toward delegated area ownership; changes will be proposed publicly and recorded here.

---

## Third-party notices

LazyNevis includes open-source dependencies distributed under their respective licenses. The authoritative dependency sets are `bun.lock` and `src-tauri/Cargo.lock`. Release SBOMs enumerate the exact resolved components. CI performs advisory and license-policy checks; maintainers must review new copyleft, source-available, or unknown licenses before release.

---

Thank you for contributing. LazyNevis exists because of people willing to improve it.

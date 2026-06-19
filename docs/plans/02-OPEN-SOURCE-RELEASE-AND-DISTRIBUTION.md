# LazyNevis Open Source, Documentation, And Distribution Plan

Status: implemented in source; owner configuration and release acceptance pending

Implementation record: [02-IMPLEMENTATION-STATUS.md](02-IMPLEMENTATION-STATUS.md)

Targets: public repository, repeatable CI/CD, signed releases where credentials exist, and contributor-ready documentation  
Scope owner: documentation, repository health, GitHub configuration, release automation, packaging, OpenSpec, and installers

## Purpose

This plan prepares LazyNevis to operate as a trustworthy public open-source project. It defines the documentation set, AI guidance, OpenSpec workflow, GitHub governance, CI/CD, release artifacts, signing, supply-chain controls, installation scripts, and future package-manager distribution.

Application behavior fixes belong to [01-APP-RELEASE-READINESS.md](01-APP-RELEASE-READINESS.md).

## Implementation Principles

- Prefer GitHub-native features before third-party bots.
- Use least-privilege workflow permissions and pin third-party actions to full commit SHAs.
- Never expose signing material to pull requests from forks.
- Build release artifacts only from protected tags or an approved protected environment.
- Keep one canonical source for each kind of information; link instead of duplicating.
- Treat generated binaries, checksums, SBOMs, provenance, and release notes as one release unit.
- Do not promise a platform until its artifact passes a clean-machine installation test.

## Phase 1 - Documentation Architecture

### DOC-101 - Create the user documentation set

- [ ] Keep `README.md` as the concise English landing page.
- [ ] Add `README.pt-BR.md` with equivalent Portuguese content and language links at the top of both files.
- [ ] Add real screenshots for Dashboard, History, Settings, alerts, and both themes.
- [ ] Document supported operating systems, architectures, package formats, permission requirements, known limitations, and uninstall/data locations.
- [ ] Document development setup, tests, production builds, release flow, and troubleshooting.
- [ ] Add a linked Buy Me a Coffee badge/image; do not embed the supplied JavaScript because GitHub strips scripts.
- [ ] Add a glossary covering session, focus rule, allowlist, blocklist, distraction, idle, checkpoint, overlay, cooldown, and break.

Acceptance criteria:

- A new user can choose a package and understand permissions without reading source code.
- A new contributor can run and test the app using only documented commands.

### DOC-102 - Add community health files

- [ ] Add `CONTRIBUTING.md` with setup, branch naming, code rules, test expectations, i18n rules, OpenSpec requirements, commits, and PR flow.
- [ ] Add `CODE_OF_CONDUCT.md`, preferably Contributor Covenant with attribution.
- [ ] Add `SECURITY.md` with supported versions, private vulnerability reporting, response expectations, and a warning not to disclose secrets publicly.
- [ ] Add `PRIVACY.md` describing local data, optional update-check traffic, exports, deletion, and absence of telemetry.
- [ ] Add `SUPPORT.md` separating usage questions, bugs, feature proposals, and security reports.
- [ ] Add `GOVERNANCE.md` explaining the maintainer's final merge/release authority and how that may evolve.
- [ ] Add `ROADMAP.md` with near-term, later, and explicitly non-committed work.
- [ ] Add `THIRD_PARTY_NOTICES.md` if dependency license review finds required notices.

### DOC-103 - Document architecture by capability

- [ ] Add `docs/architecture/overview.md` with runtime boundaries and a Mermaid context/container diagram.
- [ ] Add `docs/architecture/frontend.md`, `backend.md`, `database.md`, `monitoring.md`, and `release.md`.
- [ ] Map each public feature to frontend entry points, Tauri commands, Rust services, storage, events, and tests.
- [ ] Add `docs/troubleshooting/` pages for permissions, audio, tray, shortcuts, Linux libraries, Gatekeeper, and SmartScreen.
- [ ] Keep implementation truth in `RTK.md`; user/contributor docs should link to it where agent-level detail is unnecessary.

## Phase 2 - OpenSpec Adoption

### SPEC-201 - Bootstrap OpenSpec

- [ ] Install or invoke the official OpenSpec CLI using a repository-compatible method.
- [ ] Initialize `openspec/` and commit its configuration.
- [ ] Add OpenSpec validation to local commands and CI.
- [ ] Document the supported OpenSpec CLI version instead of relying on an unbounded latest release.
- [ ] Do not generate every legacy spec automatically; create reviewed specs incrementally.

### SPEC-202 - Define the capability library

Create initial specs for behavior most likely to change before `0.1.0`:

- [ ] `focus-sessions`
- [ ] `session-recovery`
- [ ] `focus-rules`
- [ ] `alerts-and-cooldown`
- [ ] `break-lifecycle`
- [ ] `global-shortcuts`
- [ ] `history-and-export`
- [ ] `settings-persistence`
- [ ] `permissions-and-privacy`
- [ ] `release-update-check`

Each capability spec must contain:

- Purpose and boundaries.
- Normative requirements using consistent SHALL/SHOULD/MAY language.
- Given/When/Then scenarios for normal, error, offline, restart, and platform-specific behavior.
- Data/privacy consequences.
- Links to relevant code and tests only when useful; specs describe expected behavior, not a source-code tour.

### SPEC-203 - Define the change workflow

- [ ] Require an OpenSpec proposal for new features, behavior changes, schema changes, security changes, and cross-module refactors.
- [ ] Allow documentation-only, test-only, dependency-only, and trivial bug fixes to use a documented exemption.
- [ ] Use `openspec/changes/<change-id>/proposal.md`, `design.md`, `tasks.md`, and spec deltas.
- [ ] Require proposal approval before implementation for externally contributed features.
- [ ] Require tests to reference the scenarios they satisfy when practical.
- [ ] Archive/merge approved deltas into capability specs when the change is completed.
- [ ] Add an OpenSpec checkbox to the PR template.

### SPEC-204 - Prevent duplication

- [ ] Define `RTK.md` as current technical implementation context.
- [ ] Define OpenSpec as normative product behavior and proposed behavior changes.
- [ ] Define architecture docs as explanatory system maps and decisions.
- [ ] Define ADRs as durable records of significant technical decisions.
- [ ] Define README files as user/contributor entry points.

## Phase 3 - Universal AI Guidance

### AI-301 - Establish canonical AI instructions

- [ ] Keep `AGENTS.md` as the universal entry point and require reading `RTK.md` plus relevant OpenSpec specs.
- [ ] Add a task-routing section: behavior changes start with OpenSpec; implementation context comes from `RTK.md`; visual work reads `DESIGN.md`; release work reads architecture/release docs.
- [ ] Require agents to declare task IDs, files owned, validation performed, and unresolved risks.
- [ ] Require updates to specs and tests when behavior changes.
- [ ] Keep instructions concise enough that tools reliably load them.

### AI-302 - Add thin tool adapters

- [ ] Keep `CLAUDE.md` and `.claude/rules/project-rules.md` aligned.
- [ ] Keep `.cursor/rules/lazy-nevis.mdc` aligned.
- [ ] Add `.github/copilot-instructions.md` for GitHub Copilot.
- [ ] Add `GEMINI.md` for Gemini CLI and Antigravity.
- [ ] Confirm OpenCode and Codex discover `AGENTS.md`; add a thin adapter only if their documented behavior requires it.
- [ ] Add VS Code tasks/settings recommendations without placing project rules in editor-specific configuration.
- [ ] Link every adapter to `AGENTS.md`, `RTK.md`, and OpenSpec rather than copying the entire canonical content.

### AI-303 - Add drift protection

- [ ] Add a script that checks required instruction files and canonical links.
- [ ] Add a PR checklist item for agent-document changes.
- [ ] Update `AGENTS.md`, `CLAUDE.md`, `.claude/rules/project-rules.md`, and `.cursor/rules/lazy-nevis.mdc` together when shared rules change.
- [ ] Include Copilot/Gemini adapters in the same alignment rule after they are added.

## Phase 4 - Issue And Pull Request Experience

### GH-401 - Add structured Issue Forms

- [ ] Add `.github/ISSUE_TEMPLATE/bug.yml` with required problem, expected behavior, version, OS/architecture, reproduction steps, logs, and media fields.
- [ ] Add `feature.yml` with problem, proposed outcome, alternatives, privacy impact, and willingness to contribute.
- [ ] Add `documentation.yml` and a configuration file that disables blank issues or routes them appropriately.
- [ ] Direct vulnerabilities to `SECURITY.md`, not a public issue.
- [ ] Avoid making screenshots mandatory when the bug cannot reasonably be captured.

### GH-402 - Add the pull request template

- [ ] Add summary, detailed change, type, linked issue, OpenSpec change, screenshots/video, tests, platform coverage, privacy/security impact, migration impact, and checklist sections.
- [ ] Require contributors to state what they did not test.
- [ ] Include release-note and breaking-change fields.

### GH-403 - Add ownership and labels

- [ ] Add `.github/CODEOWNERS` with `@simstm` as owner of the repository and especially `.github/`, release workflows, security policy, and ownership files.
- [ ] Define labels for bug, feature, documentation, security, platform, architecture, needs-triage, needs-reproduction, blocked, good-first-issue, and release blocker.
- [ ] Add optional label automation only after filenames and label taxonomy stabilize.

## Phase 5 - GitHub Security And Repository Rules

### GH-501 - Protect the default branch

Configure a ruleset for `main` with:

- [ ] Pull requests required.
- [ ] At least one approval from a code owner for external contributions.
- [ ] Stale approvals dismissed after new commits.
- [ ] Approval required for the latest reviewable push where appropriate.
- [ ] Required status checks for frontend, Rust, lint, security, OpenSpec, and build smoke jobs.
- [ ] Required conversation resolution.
- [ ] No force pushes or branch deletion.
- [ ] Linear history if squash/rebase is the selected merge strategy.
- [ ] Rules applied to administrators, with an emergency bypass limited to the owner and auditable.

Note: a sole maintainer cannot meaningfully approve their own pull request as an independent reviewer. Owner-authored changes should still require all checks; external changes require the owner's code-owner approval before merge.

### GH-502 - Protect release tags and environments

- [ ] Add a tag ruleset for `v*` that blocks updates and deletion.
- [ ] Create protected `release` and optional `release-signing` environments.
- [ ] Require maintainer approval before workflows can access signing secrets or publish a release.
- [ ] Prevent fork-originated workflows from reading repository/environment secrets.

### GH-503 - Enable GitHub-native security

- [ ] Enable private vulnerability reporting.
- [ ] Enable dependency graph, Dependabot alerts, and Dependabot security updates.
- [ ] Add `.github/dependabot.yml` for Bun/npm, Cargo, and GitHub Actions on a controlled schedule with grouped updates.
- [ ] Enable CodeQL default setup or a reviewed advanced workflow for TypeScript and Rust.
- [ ] Enable secret scanning and push protection when available.
- [ ] Enable immutable releases.
- [ ] Review Actions permissions and set the default `GITHUB_TOKEN` to read-only.

### GH-504 - Avoid unnecessary bots

- [ ] Start with Issue Forms, Actions, Dependabot, CodeQL, CODEOWNERS, and rulesets.
- [ ] Add stale issue automation only after defining support expectations; never auto-close security or confirmed bug reports.
- [ ] Avoid third-party apps that request broad write permissions unless they solve a measured problem.

## Phase 6 - Continuous Integration

### CI-601 - Harden dependency installation

- [ ] Pin Bun and Rust toolchain versions or channels deliberately.
- [ ] Use `bun install --frozen-lockfile` in CI.
- [ ] Cache dependencies without caching secrets or release outputs.
- [ ] Add `cargo fetch --locked`/`cargo ... --locked` where appropriate.
- [ ] Pin external GitHub Actions to full commit SHAs and document update ownership.

### CI-602 - Add required quality jobs

- [ ] Frontend tests and build.
- [ ] Rust formatting, Clippy with warnings denied, and tests.
- [ ] Locale parity and hardcoded-string checks.
- [ ] OpenSpec validation.
- [ ] Version consistency check.
- [ ] Workflow linting with actionlint.
- [ ] ShellCheck for shell scripts and PSScriptAnalyzer for PowerShell.
- [ ] Dependency/license/security checks with an explicit policy for allowed failures.

### CI-603 - Make PR builds safe and useful

- [ ] Build unsigned smoke artifacts on Linux, macOS, and Windows where minutes permit.
- [ ] Do not sign or publish PR artifacts from forks.
- [ ] Set explicit workflow `permissions` per job.
- [ ] Avoid `pull_request_target` for building untrusted contributor code.
- [ ] Give jobs unique stable names suitable for required checks.
- [ ] Set timeouts and concurrency cancellation for superseded PR runs.

## Phase 7 - Release Automation And Artifacts

### REL-701 - Define the release lifecycle

- [ ] Use Conventional Commits or another documented changelog input format.
- [ ] Define release preparation as a reviewed PR that updates version files and `CHANGELOG.md`.
- [ ] Support RC tags such as `v0.1.0-rc.1` and stable tags such as `v0.1.0`.
- [ ] Mark RC releases as prereleases and stable releases as non-prereleases.
- [ ] Generate release notes from merged PRs, grouped by user-facing features, fixes, security, documentation, and internal changes.
- [ ] Keep a human-edited summary at the top of each release.
- [ ] Trigger publication only from protected tags that match synchronized source versions.

### REL-702 - Build the supported matrix

Initial promised artifacts:

| Platform | Architecture | Formats | Notes |
|---|---|---|---|
| Windows | x64 | MSI and/or NSIS EXE | Signed when Windows credentials exist |
| Windows | ARM64 | MSI and/or NSIS EXE | Validate native runner/toolchain availability; use a controlled fallback if unavailable |
| macOS | ARM64 | DMG and app archive | Developer ID signed and notarized when Apple credentials exist |
| Linux | x64 | AppImage, DEB, RPM | Test Debian/Ubuntu and one RPM-family distribution |

- [ ] Pin runner images instead of relying blindly on changing `*-latest` labels.
- [ ] Use explicit Rust targets and Tauri build arguments for every matrix entry.
- [ ] Fail when an expected artifact is missing; do not use warning-only behavior for release jobs.
- [ ] Normalize artifact names to include app, version, OS, architecture, and package type.
- [ ] Do not claim Alpine/APK support until a musl/WebKitGTK-compatible package is proven.
- [ ] Consider Linux ARM64, macOS x64, Snap, and Flatpak after the initial matrix is stable.

### REL-703 - Sign and notarize macOS artifacts

- [ ] Obtain Apple Developer Program membership and a Developer ID Application certificate.
- [ ] Export the certificate/private key for CI into an encrypted secret or use an approved signing integration.
- [ ] Configure hardened runtime and required entitlements.
- [ ] Configure Tauri/macOS signing environment variables according to the current official Tauri documentation.
- [ ] Authenticate notarization using an App Store Connect API key where supported, otherwise an app-specific password.
- [ ] Notarize and staple the ticket to DMG/app artifacts.
- [ ] Verify with `codesign`, `spctl`, `stapler`, and a clean Mac download test.
- [ ] Until credentials exist, publish RC artifacts as unsigned/ad-hoc with an explicit Gatekeeper warning; never disable Gatekeeper in scripts.

### REL-704 - Sign Windows artifacts

- [ ] Choose Azure Artifact Signing/Trusted Signing if available to the maintainer and region, otherwise obtain a suitable code-signing certificate.
- [ ] Prefer identity/federated credentials or a managed signing service over storing an exportable private key.
- [ ] If a PFX is unavoidable, store it only as an environment secret with a separate password and strict approvals.
- [ ] Configure Tauri `signCommand` or certificate settings based on the selected provider.
- [ ] Timestamp every signature.
- [ ] Verify Authenticode signatures and test SmartScreen behavior on a clean Windows installation.
- [ ] Keep unsigned RC fallback clearly labeled until signing is available.

### REL-705 - Add Linux trust metadata

- [ ] Generate checksums for every Linux artifact.
- [ ] Optionally sign checksum manifests or AppImages with a dedicated GPG/minisign key.
- [ ] Document required runtime libraries and tested distributions.
- [ ] Verify desktop entry, icon, tray integration, audio, and uninstall behavior.

### REL-706 - Add supply-chain outputs

- [ ] Generate `SHA256SUMS` after all artifacts are final.
- [ ] Generate an SBOM covering Rust and frontend dependencies, preferably CycloneDX or SPDX.
- [ ] Generate GitHub artifact attestations for released binaries and checksum/SBOM files.
- [ ] Publish verification instructions using checksums, native signatures, and `gh attestation verify`/release verification.
- [ ] Ensure checksums are never computed before signing/notarization modifies an artifact.

### REL-707 - Separate updater signing from OS signing

- [ ] Document that `TAURI_SIGNING_PRIVATE_KEY` is for Tauri updater artifacts and does not replace Apple Developer ID or Windows Authenticode signing.
- [ ] Remove misleading updater-signing configuration until an updater is actually implemented, or configure it intentionally for future use.
- [ ] Keep the current product decision: notify about updates but do not auto-update.

## Phase 8 - One-Run Installation

### INST-801 - Define the installer contract

- [ ] Support latest stable by default and `--version <semver>` for pinned installs.
- [ ] Support `--prerelease` only when explicitly requested.
- [ ] Detect OS, CPU architecture, existing installation, and available package tools.
- [ ] Download only from the official GitHub repository over HTTPS.
- [ ] Download and verify `SHA256SUMS` before opening or executing an artifact.
- [ ] Verify native signature/attestation when the necessary local tooling exists.
- [ ] Abort on mismatch, partial download, unsupported architecture, or ambiguous asset selection.
- [ ] Use secure temporary files, cleanup traps/finally blocks, clear exit codes, and non-destructive retries.
- [ ] Provide `--dry-run`, `--help`, `--version`, `--install-dir`, and non-interactive behavior.
- [ ] Never use `sudo` without explaining why and asking through the normal OS prompt.

### INST-802 - Implement `scripts/install.sh`

- [ ] Support macOS ARM64 and Linux x64 initially.
- [ ] On macOS, install to `/Applications` or user-selected `~/Applications`; handle DMG mount/copy/eject safely.
- [ ] On unsigned macOS releases, explain Apple's supported “Open Anyway” path without running `xattr`, disabling Gatekeeper, or altering security policy.
- [ ] On Linux, install AppImage under `~/.local/bin` by default and create/update a `.desktop` entry and icon.
- [ ] Optionally install DEB/RPM when explicitly requested and the matching package manager exists.
- [ ] Pass ShellCheck and test in disposable environments.

### INST-803 - Implement `scripts/install.ps1`

- [ ] Support Windows x64 and ARM64.
- [ ] Select MSI/NSIS consistently and use documented silent flags only when requested.
- [ ] Validate SHA-256 with PowerShell-native APIs.
- [ ] Validate Authenticode when the artifact is signed.
- [ ] Preserve useful installer exit codes and logs.
- [ ] Do not weaken execution policy or SmartScreen settings.
- [ ] Pass PSScriptAnalyzer and test in Windows Sandbox/clean VMs.

### INST-804 - Provide safe invocation choices

- [ ] Offer a short one-command installation for convenience.
- [ ] Also offer the safer two-step download, inspect, then execute flow as the recommended path.
- [ ] Publish versioned installer scripts as release assets with checksums and attestations.
- [ ] State clearly that piping a remote script directly to a shell cannot independently verify the bootstrap script before execution.

### INST-805 - Add installer tests

- [ ] Unit-test asset selection, SemVer handling, checksum parsing, unsupported systems, and failure cleanup.
- [ ] Add mocked GitHub API/release responses to avoid rate limits in routine tests.
- [ ] Run end-to-end installer tests against a draft/test repository or prerelease assets before stable publication.
- [ ] Verify reinstall, upgrade, install path with spaces, offline failure, and corrupted download behavior.

## Phase 9 - Package Managers And Stores

### DIST-901 - Publish low-maintenance channels first

- [ ] Create a Homebrew Cask after a stable macOS artifact URL and checksum exist.
- [ ] Create a Winget manifest after stable signed Windows artifacts exist.
- [ ] Evaluate Chocolatey after the Windows installer and moderation requirements are stable.
- [ ] Automate manifest update PRs from releases without granting package repositories broad access to this repository.

### DIST-902 - Evaluate higher-maintenance channels later

- [ ] Evaluate an APT repository only after demand justifies repository signing, metadata, mirroring, and support.
- [ ] Evaluate RPM repositories, AUR, Snap, and Flatpak independently.
- [ ] Defer Alpine APK until the desktop runtime is technically supported and tested.
- [ ] Treat Microsoft Store and Mac App Store as separate projects with policy, sandbox, identity, and review constraints.
- [ ] Document that the current macOS private APIs and active-window monitoring may make Mac App Store distribution unsuitable without architectural changes.

## Phase 10 - Final Repository Review

### OSS-1001 - Run the community profile audit

- [ ] Verify license, README, contribution guide, code of conduct, security policy, issue templates, PR template, and support links appear correctly on GitHub.
- [ ] Verify no personal local settings, credentials, database files, logs, build outputs, certificates, provisioning profiles, or signing keys are tracked.
- [ ] Ignore `.claude/settings.local.json` and equivalent machine-local files while retaining shared agent rules.
- [ ] Review Git history for secrets and oversized binaries before the first public push.

### OSS-1002 - Validate the release pipeline without publishing stable

- [ ] Run CI from a clean public-style fork PR with no secrets.
- [ ] Run an approved RC build through protected release environments.
- [ ] Verify every expected artifact, signature status, checksum, SBOM, attestation, and release note.
- [ ] Install the exact downloaded release assets on clean machines.
- [ ] Publish `v0.1.0-rc.1` as a prerelease only after these checks pass.

## Definition Of Done

This plan is complete when:

- The repository is understandable and safe for first-time users and contributors.
- OpenSpec, canonical agent context, and tool-specific adapters have explicit non-overlapping roles.
- Branches, tags, environments, and secrets have least-privilege protection.
- PR checks are deterministic and release jobs never execute untrusted fork code with secrets.
- Every advertised platform has a verified artifact and installation path.
- Releases include notes, checksums, SBOM, provenance, and native signatures where credentials are available.
- One-run installers fail closed and never weaken operating-system security.

## Authoritative References

External requirements change. Implementing agents must re-check the current official documentation before editing release workflows or purchasing signing services.

- [OpenSpec](https://openspec.dev/)
- [Tauri GitHub pipelines](https://v2.tauri.app/distribute/pipelines/github/)
- [Tauri macOS code signing](https://v2.tauri.app/distribute/sign/macos/)
- [Tauri Windows code signing](https://v2.tauri.app/distribute/sign/windows/)
- [Tauri Linux code signing](https://v2.tauri.app/distribute/sign/linux/)
- [Apple Developer ID distribution](https://developer.apple.com/developer-id/)
- [GitHub repository rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets)
- [GitHub Issue Forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)
- [GitHub CodeQL default setup](https://docs.github.com/en/code-security/code-scanning/enabling-code-scanning/configuring-default-setup-for-code-scanning)
- [GitHub Dependabot alerts](https://docs.github.com/en/code-security/dependabot/dependabot-alerts/about-dependabot-alerts)
- [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
- [GitHub release integrity verification](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/verifying-the-integrity-of-a-release)

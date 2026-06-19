# LazyNevis Execution Guide And Manual Actions

Status: operator guide  
Audience: repository owner and implementation agents

## What Each Plan Is For

### [01-APP-RELEASE-READINESS.md](01-APP-RELEASE-READINESS.md)

Use this plan for application code and behavior. It covers incomplete features, defects, persistence, security boundaries, update notification, donation UI, accessibility, tests, and clean-machine acceptance.

Primary directories:

- `src/`
- `src-tauri/`
- Application tests and migrations
- Behavior-related OpenSpec changes

### [02-OPEN-SOURCE-RELEASE-AND-DISTRIBUTION.md](02-OPEN-SOURCE-RELEASE-AND-DISTRIBUTION.md)

Use this plan for public repository operation. It covers documentation, policies, OpenSpec bootstrap, AI guidance, GitHub templates/rules, CI/CD, signing, artifacts, checksums, attestations, package managers, and one-run installers.

Primary directories:

- `docs/`
- `openspec/`
- `.github/`
- `.claude/`, `.cursor/`, and other AI adapter files
- `scripts/`
- Release/version configuration

### This guide

Use this file to sequence the work, assign agents, configure external accounts, and perform owner-only actions that cannot be safely completed from source code alone.

## Recommended Execution Order

1. Preserve and audit the current local repository.
2. Create the private or public GitHub repository only after the secret/history audit.
3. Implement baseline quality gates and version consistency.
4. Bootstrap OpenSpec and write specs for tasks about to change.
5. Complete P0 application readiness work.
6. Add documentation, community files, templates, and AI adapters.
7. Harden CI and validate fork PR behavior.
8. Configure branch/tag rules and security features.
9. Configure unsigned multi-platform RC builds.
10. Add checksums, SBOMs, attestations, and one-run installers.
11. Configure signing credentials and protected release environments.
12. Publish and test `v0.1.0-rc.1`.
13. Resolve RC feedback and publish `v0.1.0`.
14. Add package-manager distribution after stable artifact URLs exist.

Application work and documentation work may overlap, but release documentation must be reconciled after behavior is final. Signing and stable package manifests must wait for verified artifacts.

## Coordinating Separate Agents

### Before assigning work

- Give each agent a dedicated branch or worktree.
- Assign explicit task IDs, for example `APP-101` or `DOC-102`.
- Assign a non-overlapping file set.
- State required validation and expected output.
- Require the agent to read `RTK.md`, `AGENTS.md`, the relevant plan section, and relevant OpenSpec specs.
- Do not ask two agents to edit shared files such as locale JSON, `src-tauri/src/lib.rs`, `RTK.md`, or a workflow simultaneously.

### Suggested workstreams

**Agent A - Application stabilization**

- Owns `APP-*` tasks.
- Starts with baseline, shortcuts, breaks, panics, migrations, and tests.
- Produces behavior specs/deltas before implementation.

**Agent B - Documentation and contributor experience**

- Owns `DOC-*`, `SPEC-*`, `AI-*`, `GH-401` through `GH-403`.
- May work in parallel with Agent A using current behavior as provisional.
- Reconciles claims after Agent A completes validation.

**Agent C - CI, release, signing scaffolding, and installers**

- Owns `GH-5xx`, `CI-*`, `REL-*`, `INST-*`, and `DIST-*`.
- Must not enable publication or use real secrets until owner approval.
- Depends on the version policy and initial build matrix.

### Required handoff format

Every agent should report:

```text
Task IDs completed:
Files changed:
Behavior/spec changes:
Commands run and results:
Manual tests performed:
Known risks or deferred items:
External/manual actions still required:
```

Merge smaller dependency PRs first. Rebase or refresh later branches after shared files change; do not resolve conflicts by discarding another agent's work.

## Owner-Only Or External Manual Actions

The following actions require your account, payment, identity verification, device access, or a decision that an agent should not make autonomously.

## 1. Audit Before The First Push

- [ ] Review every untracked file and confirm it belongs in the public repository.
- [ ] Remove `.DS_Store`, logs, databases, exports, local settings, build outputs, and credentials.
- [ ] Add `.claude/settings.local.json` and equivalent local-only files to `.gitignore`.
- [ ] Search for secrets before committing:

```bash
rg -n --hidden \
  -g '!node_modules/**' \
  -g '!src-tauri/target/**' \
  -e 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY' \
  -e 'ghp_[A-Za-z0-9]+' \
  -e 'github_pat_' \
  -e 'AKIA[0-9A-Z]{16}' \
  -e 'APPLE_PASSWORD|CERTIFICATE_PASSWORD|PRIVATE_KEY'
```

- [ ] Run a dedicated secret scanner such as Gitleaks before making the repository public.
- [ ] Review large files and repository size.
- [ ] Confirm the MIT license and project name are intentional.

Because the repository currently has no tracked initial history or configured remote, treat the first commit as a release artifact: review it before pushing.

## 2. Create And Connect The GitHub Repository

Authenticate and inspect the intended account:

```bash
gh auth status
gh api user --jq .login
```

After the audit and initial commit, either create the repository manually in GitHub or use:

```bash
gh repo create simstm/lazy-nevis \
  --public \
  --source=. \
  --remote=origin \
  --description="A lightweight, privacy-first desktop focus tool"
```

Do not run the creation command until you are ready for the repository to be public. A safer alternative is to create it as private, finish configuration, and change visibility manually after the RC pipeline is validated.

Confirm before pushing:

```bash
git remote -v
git status --short
git log --oneline --decorate -5
```

## 3. Configure General Repository Settings

In GitHub `Settings`:

- [ ] Set the default branch to `main`.
- [ ] Enable Issues and Discussions only if you plan to monitor them.
- [ ] Disable Wiki if documentation lives in the repository.
- [ ] Select one merge strategy; squash merge is a simple default for Conventional Commits.
- [ ] Disable merge commits/rebase options that conflict with the selected history policy.
- [ ] Enable automatic head-branch deletion after merge.
- [ ] Set Actions default workflow permissions to read-only.
- [ ] Prevent Actions from creating/approving PRs unless a workflow genuinely needs it.
- [ ] Add repository topics, website, description, and social preview.
- [ ] Configure funding with `.github/FUNDING.yml` if Buy Me a Coffee is supported by the funding schema; otherwise keep the linked badge.

Some settings can be applied with `gh api`, but inspect current values first:

```bash
gh api repos/simstm/lazy-nevis
gh api repos/simstm/lazy-nevis/actions/permissions/workflow
```

Prefer the web UI for the first configuration so you can review GitHub's current option names and plan-specific availability.

## 4. Configure Labels

Create the labels defined in `GH-403`. Example:

```bash
gh label create "needs-triage" --color BFDADC --description "Awaiting maintainer triage"
gh label create "release-blocker" --color B60205 --description "Blocks the next release"
gh label create "platform: macOS" --color 5319E7
gh label create "platform: Windows" --color 0075CA
gh label create "platform: Linux" --color F9D0C4
```

Use `gh label list` first and `--force` only when intentionally updating an existing label.

## 5. Configure Branch And Tag Rulesets

In `Settings > Rules > Rulesets`, create:

### Main branch ruleset

- Target: default branch.
- Enforcement: active.
- Require pull request before merging.
- Require one approval for external contributions.
- Require Code Owner review.
- Dismiss stale approvals.
- Require conversation resolution.
- Require the stable CI job names after workflows have run at least once.
- Block force pushes and deletion.
- Apply to administrators.
- Keep the emergency bypass list limited to your account.

### Tag ruleset

- Target: `v*` tags.
- Restrict tag creation to the maintainer/release workflow.
- Block updates and deletion.
- Apply to administrators, retaining only an audited emergency bypass.

Required checks cannot always be selected until GitHub has observed their job names. Run CI once, then return to the ruleset and select the checks.

Rulesets can also be created through the REST API, but the payload is easy to misconfigure. Export the final ruleset JSON for documentation after verifying it in the UI:

```bash
gh api repos/simstm/lazy-nevis/rulesets
```

## 6. Enable Security Features

In `Settings > Security` or the repository Security tab:

- [ ] Enable dependency graph.
- [ ] Enable Dependabot alerts and security updates.
- [ ] Enable CodeQL default setup after confirming TypeScript and Rust coverage.
- [ ] Enable secret scanning and push protection where offered.
- [ ] Enable private vulnerability reporting.
- [ ] Configure access to security alerts only for trusted maintainers.
- [ ] Enable immutable releases.

Review Dependabot PRs; do not auto-merge dependency changes before the cross-platform suite is reliable.

## 7. Create Protected Release Environments

Create `release` and, if desired, `release-signing` under `Settings > Environments`:

- [ ] Add yourself as required reviewer.
- [ ] Limit deployment branches/tags to protected `v*` tags.
- [ ] Put signing secrets in the environment, not repository-wide secrets.
- [ ] Add a short wait timer only if it provides useful cancellation time.
- [ ] Verify fork PRs cannot invoke jobs that receive these secrets.

An agent can write the workflows, but you must approve environment deployment and add real credentials.

## 8. Apple Developer ID And Notarization

For warning-free distribution outside the Mac App Store:

- [ ] Join the paid Apple Developer Program.
- [ ] Confirm the legal account holder and Team ID.
- [ ] Create a `Developer ID Application` certificate, not only an Apple Development certificate.
- [ ] Export the certificate and private key as a password-protected `.p12` if CI import is used.
- [ ] Create an App Store Connect API key with the minimum role needed for notarization, where supported.
- [ ] Store certificate data, password, identity, Team ID, issuer ID, and API key only in the protected signing environment.
- [ ] Keep an encrypted offline backup and document certificate expiry/revocation response.
- [ ] Test signing/notarization on an RC before stable release.

Never commit `.p12`, `.cer`, `.mobileprovision`, `.p8`, keychain files, app-specific passwords, or API credentials.

Without paid credentials, approve publication only as an explicitly unsigned/ad-hoc prerelease. Users will need Apple's supported “Open Anyway” flow. The installer must not remove quarantine or disable Gatekeeper.

## 9. Windows Code Signing

You must choose and enroll in a signing provider. Recommended evaluation order:

1. Azure Artifact Signing/Trusted Signing if it accepts your identity and region.
2. A managed cloud signing service compatible with Tauri `signCommand`.
3. A conventional organization/individual code-signing certificate when the other options are unavailable.

Manual work:

- [ ] Complete identity/business verification required by the provider.
- [ ] Create the signing account/certificate profile.
- [ ] Configure timestamping.
- [ ] Create minimum-privilege CI credentials, preferably federated rather than a reusable client secret.
- [ ] Store values in the protected signing environment.
- [ ] Verify publisher name and Authenticode chain on a clean Windows machine.
- [ ] Confirm current SmartScreen behavior; signing and reputation are related but not identical.

Never commit PFX files or passwords. If a PFX is unavoidable, keep it encrypted as an environment secret and rotate it according to provider policy.

## 10. Release Secrets Inventory

The exact names depend on the final workflows, but maintain an owner-only inventory containing:

| Purpose | Example secret/config | Location |
|---|---|---|
| macOS certificate | Base64 certificate and password | `release-signing` environment |
| macOS identity | Developer ID identity and Team ID | environment variable/secret |
| Apple notarization | API issuer/key ID/private key or app password | `release-signing` environment |
| Windows signing | Provider account/profile and federated credentials | `release-signing` environment |
| Optional Linux signing | GPG/minisign private key and passphrase | `release-signing` environment |
| Tauri updater | Private key/password only if updater is later enabled | separate environment |

Do not create an updater private key merely because the current workflow references `TAURI_SIGNING_PRIVATE_KEY`; it is unrelated to native OS signing.

## 11. Clean-Machine Test Access

Arrange access to:

- [ ] Apple Silicon Mac on a supported clean macOS version.
- [ ] Windows x64 VM/device.
- [ ] Windows ARM64 VM/device or validated hosted ARM runner plus a real-device confirmation when possible.
- [ ] Ubuntu/Debian VM.
- [ ] Fedora or another RPM-family VM.

For each artifact, record:

- OS/version and architecture.
- Artifact filename and SHA-256.
- Signature/notarization result.
- Install, first launch, permission, tray, shortcut, audio, autostart, update check, and uninstall results.
- Residual files and known limitations.

## 12. Publish The Release Candidate

Before approving `v0.1.0-rc.1`:

- [ ] Confirm the release commit is merged and all version files say `0.1.0-rc.1`.
- [ ] Confirm the changelog and OpenSpec deltas are complete.
- [ ] Confirm all required checks pass on the tagged commit.
- [ ] Approve the protected release environment.
- [ ] Confirm all expected artifacts are present.
- [ ] Confirm checksums were generated after signing/notarization.
- [ ] Confirm SBOM and attestations are attached.
- [ ] Verify the release is marked prerelease and has clear unsigned-platform warnings where relevant.
- [ ] Install assets downloaded from GitHub Releases, not local build outputs.
- [ ] Test one-run installers against the published RC using explicit prerelease opt-in.

Useful verification commands after publication:

```bash
gh release view v0.1.0-rc.1 --repo simstm/lazy-nevis
gh release download v0.1.0-rc.1 --repo simstm/lazy-nevis --dir /tmp/lazynevis-rc
gh release verify v0.1.0-rc.1 --repo simstm/lazy-nevis
```

Also perform native `codesign`/`spctl` and Authenticode verification on their respective platforms.

## 13. Promote To Stable

- [ ] Define an RC observation period and blocking severity policy.
- [ ] Resolve all crash, data-loss, security, installation, and core-workflow blockers.
- [ ] Create a new stable release commit and `v0.1.0` tag; do not rename RC artifacts.
- [ ] Repeat release builds and clean-machine checks.
- [ ] Update README download links to stable assets.
- [ ] Publish package-manager manifests only after stable URLs and checksums exist.
- [ ] Monitor Issues, security reports, and failed installations after launch.

## 14. Store And Package Manager Accounts

These require manual account ownership or external repository review:

- Homebrew: create/maintain a tap or submit a cask after stable notarized macOS artifacts exist.
- Winget: submit manifests to Microsoft's community repository after signed stable Windows artifacts exist.
- Chocolatey: create an account/package and comply with moderation requirements.
- Microsoft Store: create a Partner Center account and meet identity/signing/store requirements.
- Mac App Store: requires Apple membership and likely architectural review because sandboxing and current private APIs/active-window monitoring may conflict.
- APT/RPM repositories: require signing keys, hosted metadata, rotation, availability, and ongoing operations; defer until demand exists.

Do not allow an agent to register paid accounts, accept legal agreements, publish under your identity, or upload secrets without your direct review.

## Final Owner Checklist

- [ ] I reviewed the initial Git history and secret scan.
- [ ] I understand which artifacts are signed and which are not.
- [ ] I control every signing identity and recovery method.
- [ ] Branch/tag rules and release environments are active.
- [ ] External PRs cannot access secrets or publish releases.
- [ ] User-facing claims match tested platforms.
- [ ] Privacy documentation includes the update check.
- [ ] The RC was installed from GitHub on clean systems.
- [ ] The one-run scripts validated checksums and failed safely in negative tests.
- [ ] Known limitations are visible in release notes and documentation.
- [ ] I personally approve the final public visibility and stable release.

# Plan 02 Implementation Status

Implemented in the repository on 2026-06-19:

- DOC-101 through DOC-103: bilingual entry docs, community policies, architecture/troubleshooting/release documentation, glossary, permissions/platform/data guidance, and an RC screenshot capture contract.
- SPEC-201 through SPEC-204: pinned OpenSpec 1.3.1, project config, strict validation, ten reviewed capability specs, and change workflow/role boundaries.
- AI-301 through AI-303 and GH-401 through GH-403: canonical routing, aligned adapters/drift gate, VS Code tasks, Issue Forms, PR template, CODEOWNERS, label taxonomy, funding, Dependabot, and release-note categories.
- CI-601 through CI-603: pinned toolchains/actions, frozen/locked installs, distinct frontend/Rust/repository/PowerShell/dependency/CodeQL gates, Linux-safe Clippy, and unsigned cross-platform smoke builds.
- REL-701 through REL-707: protected-tag release source validation, RC/stable handling, explicit artifact matrix, optional native credential scaffolding, stable signature gates, normalized outputs, final checksums, CycloneDX SBOM, attestations, notes, and updater/native-signing separation.
- INST-801 through INST-805: fail-closed shell/PowerShell installers, pinned/prerelease/dry-run/path modes, checksum/native signature checks, unit/smoke tests and mocked release selection primitives.
- DIST-901/DIST-902 and OSS-1001: explicit channel gates, repository audit script, local-file ignores, and owner checklist.

External evidence still required before the plan's release Definition of Done can truthfully be declared complete:

- GitHub account settings, labels, rulesets, environments, private reporting, security features, read-only token default, and immutable releases must be enabled by `@simstm`.
- Apple/Microsoft identity purchase or enrollment, secrets, native signing/notarization, timestamping, and reputation tests require maintainer accounts.
- Real RC screenshots, fork/no-secret CI, clean-machine install/reinstall/upgrade/offline/corruption tests, Linux desktop checks, Gatekeeper, SmartScreen, and exact artifact inspection require the release candidates and target machines.
- `v0.1.0-rc.1`, stable release, Homebrew, and Winget publication are intentionally gated and were not published by implementation work.

Use `docs/release/operator-checklist.md` and `docs/plans/03-EXECUTION-GUIDE-AND-MANUAL-ACTIONS.md` to collect that evidence. Repository automation fails stable publication when native signatures are absent.

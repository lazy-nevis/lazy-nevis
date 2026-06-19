# Release Operator Checklist

Repository code cannot purchase identities, add secrets, enable GitHub settings, or test physical clean machines. The maintainer must:

- Enable private vulnerability reporting, dependency graph/alerts/security updates, secret scanning/push protection, immutable releases, and read-only Actions defaults.
- Apply the documented default-branch and `v*` tag rulesets; create protected `release` and `release-signing` environments with approval and protected-tag restrictions.
- Configure Apple Developer ID/notarization and Windows managed signing, then verify timestamped native signatures.
- Run fork PR CI with no secrets, an approved `v0.1.0-rc.1`, clean-machine installs, reinstall/upgrade/path-with-spaces/offline/corruption cases, Linux desktop/tray/audio/uninstall checks, Gatekeeper, and SmartScreen.
- Inspect every expected artifact, release note, `SHA256SUMS`, SBOM, and attestation before publishing stable.
- Create Homebrew/Winget manifests only after stable verified URLs exist.

Detailed account and ruleset steps remain in `docs/plans/03-EXECUTION-GUIDE-AND-MANUAL-ACTIONS.md`.

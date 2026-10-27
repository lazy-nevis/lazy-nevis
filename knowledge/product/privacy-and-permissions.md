# Privacy and permissions

## Purpose

Keep focus monitoring understandable, least-privilege, and local-first.

## Invariants

- No telemetry; session and observed titles stay local unless the user explicitly exports.
- Request only permissions needed for an enabled capability; degrade when optional permissions are denied.
- Manual GitHub release check is the intentional outbound product path; it does not download updates.
- User can export and delete local application records; external exports and source audio files are not deleted by in-app reset.

## Normative capabilities

- `knowledge/product/capabilities/permissions-and-privacy.md`
- `knowledge/product/capabilities/release-update-check.md`
- `PRIVACY.md`, `SECURITY.md`

## Open questions

- Signing/notarization and clean-machine release acceptance remain maintainer-gated (see `RTK.md` / release docs).

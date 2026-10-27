# Roadmap

## Purpose

Hold durable product direction and improvement themes so agents do not invent priorities from chat alone.

## Known (shipped themes — see CHANGELOG)

- Local-first focus sessions, rules, alerts, history/export
- Break reminders, shortcuts, tray status / quick panel, app modes (full/compact)
- Daily checklist, notification manager, focus-transparent apps ignore list
- Screenshot automation pipeline (marketing assets)

## Improvement themes (not committed schedules)

Use OKF bundles under `knowledge/changes/` when turning a theme into work. Do not treat this list as a promised release plan.

| Theme | Notes | Status |
| --- | --- | --- |
| Reduce Rust production panics / inline SQL debt | Documented in `RTK.md` / agent adapters | Open debt |
| Eliminate remaining hardcoded UI strings | i18n parity checks exist | Open debt |
| Clean-machine multi-OS release acceptance | Maintainer-gated | Ongoing |
| Landing site feature/screenshot sync | Sibling repo `lazy-nevis.github.io` | As-needed |
| OKF scaffold generator | Optional tooling follow-up | Suggested |

## Open questions

- Maintainer-prioritized next product features after `0.10.0-rc.5` — record here when decided.
- Whether roadmap items should sync from GitHub milestones/issues automatically (not implemented).

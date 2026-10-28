# Architecture Overview

`RTK.md` is the current implementation truth. `knowledge/product/capabilities/` holds normative behavior; these pages explain boundaries; ADRs record durable decisions; READMEs are entry points.

```mermaid
flowchart LR
  U["User"] --> FE["React WebView"]
  FE -->|"Tauri invoke/events"| BE["Rust/Tauri core"]
  BE --> OS["OS windows, idle, tray, notification, audio"]
  BE --> DB["Local SQLite"]
  CI["GitHub Actions"] --> ART["Signed/unsigned packages, SBOM, checksums, attestations"]
  ART --> U
```

The frontend owns presentation and transient UI state. Rust owns privileged OS access, monitoring, classification, persistence, and native effects. No application server exists. The release system is separate from runtime and receives secrets only through protected environments.

## Capability Map

| Capability | Frontend entry | Command/service | Storage/events | Tests / capability doc |
|---|---|---|---|---|
| Sessions/recovery | `Dashboard`, `useFocusSession` | session commands, `SessionLogger`, monitor | `sessions`, `session_runtime`, `session:tick` | hook/store/Rust tests; `knowledge/product/capabilities/focus-sessions.md`, `session-recovery.md` |
| Focus rules | `Settings` | settings commands, `RuleEngine` | settings, timeline events | rule-engine tests; `focus-rules.md` |
| Alerts/breaks | `Overlay`, alert components | notification/audio/monitor commands | `alert:*`, `break:*` | overlay/Rust tests; `alerts-and-cooldown.md`, `break-lifecycle.md` |
| Shortcuts | `Settings`, `AppShell` | global-shortcut setup | settings, native registrations | settings tests; `global-shortcuts.md` |
| History/export | `History` | session commands/logger | sessions/events/checkpoints | formatter/session tests; `history-and-export.md` |
| Settings/privacy | `Settings`, permissions modal | settings/permissions/audio commands | settings and recent audio | hook tests; `settings-persistence.md`, `permissions-and-privacy.md` |
| Release updates | About | bounded GitHub check | no telemetry/history | `release-update-check.md` |

See [frontend](frontend.md), [backend](backend.md), [database](database.md), [monitoring](monitoring.md), and [release](release.md).

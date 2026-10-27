# Manual test scripts

Per-feature checklists for exercising LazyNevis in the real app window. Run them against the
development build (`bun tauri dev`), never the installed `/Applications/LazyNevis.app`, so you are
testing the working tree and a disposable dev database.

Each script lists **setup**, **steps**, and **expected** results. Mark a script as failed on the
first unexpected result and note the step number in the PR or issue.

| Script | Covers |
| --- | --- |
| [00-launch.md](00-launch.md) | Launch, browser-tab guard, settings load |
| [01-window-geometry.md](01-window-geometry.md) | Size/position per mode, drag region |
| [02-shell-sidebar.md](02-shell-sidebar.md) | Collapsed rail, tooltips, toggle placement, responsive tabs |
| [03-dashboard.md](03-dashboard.md) | Overview widgets, drag, resize, reset |
| [04-sessions.md](04-sessions.md) | Sessions screen, start/pause/stop |
| [05-checklist.md](05-checklist.md) | Items, due dates, history filters |
| [06-reminders.md](06-reminders.md) | Editor pickers, markdown toolbar, delivery override |
| [07-habits.md](07-habits.md) | Icon grid, targets, reminders, logging |
| [08-pomodoro.md](08-pomodoro.md) | Always-on availability, run lifecycle |
| [09-calendar.md](09-calendar.md) | Month/week/day views, filters, new reminder |
| [10-settings-alerts.md](10-settings-alerts.md) | Alerts + delivery section, persistence |

Automated coverage lives in `bun run test` (Vitest) and `cargo test`; these scripts cover what
those cannot: native windows, focus, notifications, and visual layout.

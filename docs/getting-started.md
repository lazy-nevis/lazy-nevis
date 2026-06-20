# Getting Started with LazyNevis

Welcome to LazyNevis, a privacy-first desktop focus tool for people who want gentle nudges, not app blockers. This guide walks you through installation, your first session, and the core concepts you will reach for every day.

---

## What is LazyNevis?

LazyNevis watches which app or browser tab you have in focus while a session is running. Every second, it classifies your activity as focused, distracted, or idle — according to rules you define — and accumulates those totals. When distraction crosses a threshold you set, it alerts you: a native notification, a fullscreen overlay, or an audio cue.

It is designed for people who want visibility and a nudge, not an enforcer that closes your tabs. The history page lets you review how sessions actually went, export data as JSON or CSV, and see where focus was lost.

Everything stays on your machine. There are no accounts, no cloud sync, and no telemetry. The only outbound request is a manual "Check for updates" button that reads public release metadata from GitHub.

---

## Installing

Download the package for your platform from [GitHub Releases](https://github.com/simstm/lazy-nevis/releases).

| Platform | Guide |
|---|---|
| macOS 12+ (Apple Silicon) | [docs/install/macos.md](install/macos.md) |
| Windows 10+ (x64 or ARM64) | [docs/install/windows.md](install/windows.md) |
| Linux (x64) | [docs/install/linux.md](install/linux.md) |

For verification steps, checksum checking, and uninstall instructions, see [docs/release/installation.md](release/installation.md).

---

## Your First Session

1. **Launch LazyNevis.** On first run, a permissions modal may appear asking for Accessibility and Notifications access. Grant what you need (Accessibility is required for window monitoring).

2. **Go to the Dashboard.** This is the main screen. You will see a timer area and session controls.

3. **Click Start** (or press your configured global shortcut). The timer starts and LazyNevis begins watching the active window.

4. **Work normally.** Switch between apps, browse the web, write code — the current app name is shown live on the Dashboard. The focus/distraction/idle bars update in real time.

5. **Pause** if you step away. The timer stops counting while paused; no time is lost or double-counted.

6. **Add a checkpoint** (the bookmark icon) to mark a meaningful moment — finishing a task, switching context. Checkpoints appear in the session history detail view.

7. **Stop the session** when done. The session is saved to local history.

---

## Understanding Focus Classification

LazyNevis uses a **rule engine** to decide whether each active window counts as focused or distracted. You choose between two modes:

**Allowlist mode** — only windows that match a rule count as focused. Everything else is distraction. Use this when you know exactly what you should be working on: "only VS Code and docs.example.com count as focused."

**Blocklist mode** — everything counts as focused except windows that match a rule. Use this for a lighter touch: "flag Twitter and YouTube as distracting."

Within either mode, rules can match **application names** (e.g., `Slack`) or **browser tab titles** (e.g., tabs containing `twitter.com`). Browser title matching lets you distinguish a YouTube research video from doom-scrolling the homepage.

**Idle time** is classified separately: if no keyboard or mouse activity is detected for a configurable period, the current second is counted as idle, not focused or distracted.

LazyNevis is always excluded from classification — it will never flag itself as a distraction.

---

## Setting Up Focus Rules

1. Open **Settings** from the sidebar.
2. Go to the **Focus Rules** section.
3. Choose **Allowlist** or **Blocklist** mode.
4. Click **Add rule**.
5. Enter an app name or a browser tab title pattern (partial matches work).
6. Save.

Rules take effect immediately in any running session. You can add and remove rules without restarting the app.

---

## Alerts and Cooldowns

LazyNevis can alert you when cumulative distraction (or focused time, depending on the alert type) crosses a threshold.

**Alert types available:**

- **Native notification** — a standard OS notification
- **Fullscreen overlay** — a translucent window that appears over everything else; press Escape or click Dismiss to close it
- **Audio** — a built-in sound or a custom MP3/WAV/OGG file

**Cooldown** prevents alerts from firing repeatedly in quick succession. If an alert fires and you dismiss it, the cooldown clock starts. The next alert will not fire until the cooldown has elapsed, even if the threshold is still exceeded.

To configure alerts, go to **Settings > Alerts**. You can set the distraction threshold (in minutes), the cooldown duration, and which alert types are active.

---

## Breaks

LazyNevis can remind you to take a break based on cumulative focused time during a session.

When a break reminder fires, a native notification or overlay is shown. The Dashboard shows a break countdown timer. You can start the break, which pauses the main session timer, and end the break when you are ready to resume.

Break settings (interval, duration, alert type) are in **Settings > Breaks**.

---

## Global Shortcuts

You can control LazyNevis without switching to it. Global shortcuts work even when another app is in the foreground.

Default shortcuts (configurable in **Settings > Shortcuts**):

- Start or resume the session
- Pause the session
- Stop the session
- Show/hide the main window

If a shortcut conflicts with another app, LazyNevis will detect the conflict when you save settings and restore the previous working shortcut.

---

## History and Export

The **History** page shows all completed sessions with:

- Focus, distraction, and idle totals
- A visual timeline of window changes
- Top apps by time
- Charts showing focus percentage over time

You can filter by date range and delete individual sessions or all history.

**Export:** use the Export button to download session data as JSON (full detail) or CSV (summary table). Export is performed client-side; no data leaves your machine.

---

## Glossary

| Term | Meaning |
|---|---|
| Session | A measured focus period started and stopped explicitly. |
| Focus rule | An app name or browser title pattern used for classification. |
| Allowlist | A mode where only matching windows count as focused. |
| Blocklist | A mode where matching windows count as distracting. |
| Distraction | Time spent in a window classified as outside the focus policy. |
| Idle | Time with no detected keyboard or mouse activity. |
| Checkpoint | A timestamped note added manually inside a session. |
| Overlay | A fullscreen alert window shown above all other windows. |
| Cooldown | The minimum delay enforced between repeated alerts of the same type. |
| Break | A deliberate rest interval associated with a session; pauses the main timer. |
| Timeline | A chronological log of window changes recorded during a session. |
| Rule engine | The Rust component that classifies each active window as focused or distracted. |
| Tray | The system tray icon; LazyNevis can be operated entirely from here. |

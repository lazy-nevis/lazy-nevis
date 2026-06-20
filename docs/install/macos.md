# Installing LazyNevis on macOS

## Requirements

- macOS 12 (Monterey) or later
- Apple Silicon (ARM64)

Intel (x64) Macs are not currently supported.

---

## Step 1: Download

Go to [github.com/simstm/lazy-nevis/releases](https://github.com/simstm/lazy-nevis/releases) and find the latest release.

<!-- screenshot: GitHub Releases page showing assets for the latest release -->

Download the `.dmg` file listed under **Assets**. The file name will look like `LazyNevis_x.y.z_aarch64.dmg`.

Before opening it, verify the checksum. The release page includes a `SHA256SUMS` file:

```bash
shasum -a 256 -c SHA256SUMS
```

---

## Step 2: Gatekeeper warning (unsigned builds)

LazyNevis is currently not signed with an Apple Developer certificate. When you open the DMG or the app for the first time, macOS Gatekeeper will block it with a message like **"LazyNevis cannot be opened because Apple cannot check it for malicious software."**

This is expected for unsigned RC builds. Follow the **Open Anyway** path:

1. Open **System Settings** (Apple menu > System Settings).
2. Go to **Privacy & Security**.
3. Scroll down to the **Security** section. You should see a message about LazyNevis being blocked.
4. Click **Open Anyway**.
5. Confirm by clicking **Open** in the dialog that appears.

You only need to do this once. See [docs/troubleshooting/gatekeeper.md](../troubleshooting/gatekeeper.md) for more context.

> Signed stable releases will not require this step. See [docs/release/future-signing.md](../release/future-signing.md) for the signing plan.

---

## Step 3: Install from the DMG

<!-- screenshot: step 1 — DMG window showing LazyNevis icon and Applications folder alias -->

1. Double-click the `.dmg` file to mount it.
2. A Finder window opens showing the LazyNevis icon and a shortcut to **Applications**.

<!-- screenshot: step 2 — dragging LazyNevis into Applications -->

3. Drag **LazyNevis** into the **Applications** folder.
4. Wait for the copy to complete, then eject the DMG.

<!-- screenshot: step 3 — LazyNevis visible in Applications folder -->

---

## Step 4: Grant Accessibility permission

Window monitoring requires Accessibility access. LazyNevis will prompt you on first launch, or you can grant it manually:

1. Open **System Settings > Privacy & Security > Accessibility**.
2. Click the **+** button.
3. Navigate to **Applications** and select **LazyNevis**.
4. Enable the toggle next to LazyNevis.

<!-- screenshot: step 4 — Accessibility settings with LazyNevis toggled on -->

Without this permission, LazyNevis cannot detect which app is active and window monitoring will not work.

---

## Step 5: Grant Notifications permission (optional)

If you want native notification alerts:

1. Open **System Settings > Notifications**.
2. Find **LazyNevis** in the list.
3. Enable **Allow Notifications** and choose your preferred alert style.

This permission is optional. Fullscreen overlay alerts and audio alerts work without it.

---

## First launch

Open LazyNevis from your Applications folder. The app will:

- Show a permissions status modal if Accessibility is not yet granted.
- Start minimized to the tray (menu bar icon) on subsequent launches.
- Present the Dashboard where you can start your first session.

See [Getting Started](../getting-started.md) for a walkthrough of your first session.

---

## Uninstalling

1. Quit LazyNevis (right-click the tray icon > Quit, or Cmd+Q).
2. Drag **LazyNevis.app** from Applications to the Trash.

**Removing app data (optional):**

Session history, settings, and audio files are stored in:

```
~/Library/Application Support/br.dev.sims.lazynevis/
```

There may also be plugin-related data in:

```
~/Library/Application Support/br.dev.sims.lazynevis.*/
```

Confirm the directory name before deleting. Custom audio files you added are inside this directory and will be removed with it.

---

## Troubleshooting

- [Gatekeeper issues](../troubleshooting/gatekeeper.md)
- [Permissions](../troubleshooting/permissions.md)
- [Audio issues](../troubleshooting/audio.md)
- [Tray icon](../troubleshooting/tray.md)
- [Global shortcuts](../troubleshooting/shortcuts.md)

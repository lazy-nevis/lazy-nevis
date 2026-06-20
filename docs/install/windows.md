# Installing LazyNevis on Windows

## Requirements

- Windows 10 or later
- x64 or ARM64 architecture

---

## Step 1: Download

Go to [github.com/simstm/lazy-nevis/releases](https://github.com/simstm/lazy-nevis/releases) and find the latest release.

<!-- screenshot: GitHub Releases page showing assets for the latest release -->

Download the NSIS installer listed under **Assets**. The file name will look like `LazyNevis_x.y.z_x64-setup.exe` (or `_arm64-setup.exe` for ARM64 machines).

Before running it, verify the checksum. The release page includes a `SHA256SUMS` file. In PowerShell:

```powershell
Get-FileHash LazyNevis_x.y.z_x64-setup.exe -Algorithm SHA256
```

Compare the output hash against the entry in `SHA256SUMS`.

---

## Step 2: SmartScreen warning (unsigned builds)

LazyNevis is currently not signed with an Authenticode certificate. When you run the installer, Windows SmartScreen may block it with a message like **"Windows protected your PC."**

This is expected for unsigned RC builds. To proceed:

1. Click **More info** in the SmartScreen dialog.
2. Click **Run anyway**.

<!-- screenshot: step 1 — SmartScreen "Windows protected your PC" dialog -->
<!-- screenshot: step 2 — SmartScreen dialog after clicking "More info", showing Run anyway button -->

You only need to do this once per installer. See [docs/troubleshooting/smartscreen.md](../troubleshooting/smartscreen.md) for more context and how to verify the release before bypassing.

> Signed stable releases will not require this step. See [docs/release/future-signing.md](../release/future-signing.md) for the signing plan.

---

## Step 3: Run the NSIS installer

<!-- screenshot: step 3 — LazyNevis installer welcome screen -->

1. Double-click the downloaded `.exe` to start the installer.
2. Follow the installer prompts: choose an install location (the default is fine for most users) and click **Install**.

<!-- screenshot: step 4 — installer progress screen -->

3. Click **Finish** when the installer completes.

<!-- screenshot: step 5 — installer finish screen -->

LazyNevis is now installed. A Start Menu shortcut and optionally a desktop shortcut will be created.

---

## First launch

Launch LazyNevis from the Start Menu or desktop shortcut. On first launch the app will:

- Check for Notifications permission and prompt if needed.
- Start minimized to the system tray on subsequent launches.
- Present the Dashboard where you can start your first session.

See [Getting Started](../getting-started.md) for a walkthrough of your first session.

---

## Autostart

To have LazyNevis start automatically when you log in to Windows:

1. Open **Settings** in LazyNevis.
2. Go to the **General** section.
3. Enable **Launch at login**.

When launched at login, LazyNevis starts minimized to the tray without showing the main window.

You can also manage autostart entries in **Windows Settings > Apps > Startup**.

---

## Uninstalling

1. Right-click the tray icon and choose **Quit**.
2. Open **Windows Settings > Apps > Installed apps**.
3. Search for **LazyNevis**, click the menu (three dots), and choose **Uninstall**.
4. Follow the uninstall prompts.

**Removing app data (optional):**

Session history, settings, and audio files are stored in:

```
%APPDATA%\br.dev.sims.lazynevis\
```

or in some configurations:

```
%LOCALAPPDATA%\br.dev.sims.lazynevis\
```

Open File Explorer, paste the path into the address bar (substituting `%APPDATA%` with the actual path, e.g. `C:\Users\YourName\AppData\Roaming`), and delete the folder. Custom audio files you added are inside this folder.

---

## Troubleshooting

- [SmartScreen issues](../troubleshooting/smartscreen.md)
- [Permissions](../troubleshooting/permissions.md)
- [Audio issues](../troubleshooting/audio.md)
- [Tray icon](../troubleshooting/tray.md)
- [Global shortcuts](../troubleshooting/shortcuts.md)

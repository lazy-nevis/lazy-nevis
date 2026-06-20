# Installing LazyNevis on Linux

## Requirements

- x64 (amd64) architecture
- WebKit2GTK (required for the Tauri WebView)
- A system tray implementation (see [Tray icon](#tray-icon) below)
- PipeWire or PulseAudio for audio alerts (see [Audio](#audio) below)

ARM64 is not currently supported on Linux.

---

## Required libraries

Before installing, make sure the required libraries are present. On Debian/Ubuntu:

```bash
sudo apt-get install libwebkit2gtk-4.1-0 libgtk-3-0 libayatana-appindicator3-1
```

On Fedora/RHEL:

```bash
sudo dnf install webkit2gtk4.1 gtk3 libayatana-appindicator
```

If your desktop does not use `ayatana-appindicator`, an alternative such as `libappindicator-gtk3` may work. See [docs/troubleshooting/linux-libraries.md](../troubleshooting/linux-libraries.md) for distro-specific notes.

---

## Option 1: Install via script (recommended)

The install script downloads the AppImage, verifies the SHA-256 checksum, checks GitHub build attestation, installs it to `~/.local/bin/lazynevis`, and creates a desktop entry automatically.

### Stable release

```bash
bash <(curl -fL https://raw.githubusercontent.com/SimStm/lazy-nevis/refs/heads/main/scripts/install.sh)
```

### Pre-release / RC build

Pre-releases are not included in the `latest` URL and require the `--prerelease` flag:

```bash
bash <(curl -fL https://raw.githubusercontent.com/SimStm/lazy-nevis/refs/heads/main/scripts/install.sh) --prerelease
```

> **Why `--prerelease`?** Without this flag, the script only selects stable releases. Pre-releases are skipped unless you opt in explicitly.

To install DEB or RPM instead of AppImage, pass `--package deb` or `--package rpm`. Use `--help` for all options (custom install directory, dry-run, version pinning).

---

## Option 2: Manual download from GitHub Releases

Go to [github.com/simstm/lazy-nevis/releases](https://github.com/simstm/lazy-nevis/releases) and find the release you want. For pre-releases, look for releases labeled **Pre-release** — they do not appear as "Latest".

### AppImage

AppImage is the most portable option — it bundles its own libraries and runs on most x64 Linux distributions without installation.

<!-- screenshot: GitHub Releases page showing AppImage asset -->

Download the file ending in `.AppImage`, then verify the checksum:

```bash
sha256sum LazyNevis_x.y.z_amd64.AppImage
```

Compare the output against the `SHA256SUMS` file from the release page.

Make the file executable and launch it:

```bash
chmod +x LazyNevis_x.y.z_amd64.AppImage
./LazyNevis_x.y.z_amd64.AppImage
```

**Desktop integration (optional)**

To add LazyNevis to your application launcher:

```bash
mkdir -p ~/.local/bin
cp LazyNevis_x.y.z_amd64.AppImage ~/.local/bin/lazynevis
chmod +x ~/.local/bin/lazynevis

mkdir -p ~/.local/share/applications
cat > ~/.local/share/applications/lazynevis.desktop << 'EOF'
[Desktop Entry]
Name=LazyNevis
Exec=/home/YOUR_USERNAME/.local/bin/lazynevis
Icon=lazynevis
Type=Application
Categories=Utility;
EOF
```

Replace `YOUR_USERNAME` with your actual username in the `Exec` line.

**Uninstall (AppImage)**

```bash
rm ~/.local/bin/lazynevis
rm ~/.local/share/applications/lazynevis.desktop
```

---

### DEB package (Debian / Ubuntu)

<!-- screenshot: GitHub Releases page showing DEB asset -->

Download the `.deb` file from the release page, then install:

```bash
sudo apt install ./LazyNevis_x.y.z_amd64.deb
```

Or with `dpkg` (if `apt install ./` is not available on your version):

```bash
sudo dpkg -i LazyNevis_x.y.z_amd64.deb
sudo apt-get install -f   # resolves any missing dependencies
```

LazyNevis will be installed to `/usr/bin/lazynevis` and a `.desktop` entry will be created automatically.

**Uninstall (DEB)**

```bash
sudo apt remove lazynevis
```

---

### RPM package (Fedora / openSUSE)

<!-- screenshot: GitHub Releases page showing RPM asset -->

Download the `.rpm` file from the release page, then install:

**Fedora / RHEL:**

```bash
sudo dnf install ./LazyNevis_x.y.z_amd64.rpm
```

**openSUSE:**

```bash
sudo zypper install ./LazyNevis_x.y.z_amd64.rpm
```

Or with `rpm` directly:

```bash
sudo rpm -i LazyNevis_x.y.z_amd64.rpm
```

**Uninstall (RPM)**

```bash
sudo dnf remove lazynevis   # Fedora / RHEL
# or
sudo zypper remove lazynevis  # openSUSE
```

---

## Tray icon

LazyNevis uses a system tray icon for quick access. Tray support depends on your desktop environment and which indicator library is present.

- **GNOME:** requires the [AppIndicator and KStatusNotifierItem Support](https://extensions.gnome.org/extension/615/appindicator-support/) GNOME Shell extension, plus `libayatana-appindicator3-1`.
- **KDE Plasma, XFCE, MATE:** tray support is built-in.
- **Other desktops:** if the tray icon does not appear, install `libayatana-appindicator3-1` (Debian/Ubuntu) or `libayatana-appindicator` (Fedora).

See [docs/troubleshooting/tray.md](../troubleshooting/tray.md) if the tray icon is missing.

---

## Audio

Audio alerts require PipeWire or PulseAudio. Most modern desktop distributions include one of these by default. If audio alerts are silent:

- Verify PipeWire or PulseAudio is running: `pactl info`
- See [docs/troubleshooting/audio.md](../troubleshooting/audio.md)

---

## Autostart

On Linux, autostart is managed by placing a `.desktop` file in `~/.config/autostart/`.

When you enable **Launch at login** in LazyNevis Settings, the app writes this file automatically. When disabled, it removes the file. The autostart entry launches LazyNevis minimized to the tray.

---

## Data location

Session history, settings, and audio files are stored at:

```
~/.local/share/br.dev.sims.lazynevis/
```

Some data may also be under:

```
~/.config/br.dev.sims.lazynevis/
```

Check the XDG base directories (`$XDG_DATA_HOME`, `$XDG_CONFIG_HOME`) if your system uses non-default locations. Custom audio files you added are inside these directories.

---

## Troubleshooting

- [Missing libraries](../troubleshooting/linux-libraries.md)
- [Tray icon](../troubleshooting/tray.md)
- [Audio issues](../troubleshooting/audio.md)
- [Global shortcuts](../troubleshooting/shortcuts.md)
- [Permissions](../troubleshooting/permissions.md)

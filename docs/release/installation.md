# Installation And Uninstall

Download only from `https://github.com/simstm/lazy-nevis/releases`. Verify `SHA256SUMS` before opening an artifact and use native signature checks plus `gh attestation verify <file> --repo simstm/lazy-nevis` when available.

## Install scripts

The install scripts download the correct artifact for your platform, verify the SHA-256 checksum, check GitHub build attestation, and run the native installer or place the binary.

### Stable release

**macOS / Linux:**

```bash
curl -fL https://github.com/simstm/lazy-nevis/releases/latest/download/install.sh -o install.sh
less install.sh         # optional: inspect before running
sh install.sh
```

**Windows (PowerShell):**

```powershell
Invoke-WebRequest https://github.com/simstm/lazy-nevis/releases/latest/download/install.ps1 -OutFile install.ps1
Get-Content .\install.ps1   # optional: inspect before running
.\install.ps1
```

### Pre-release / RC build

> **Note:** Pre-releases are **not** included in the `latest` URL. GitHub's `releases/latest` always resolves to the most recent stable (non-pre-release) release. If you run the stable commands above when only RC builds have been published, the download will fail with a "release not found" error.

To install a pre-release, download the script from the specific release tag and pass `--prerelease` / `-Prerelease`:

**macOS / Linux:**

```bash
# Replace v0.1.0-rc.1 with the RC version shown on the Releases page
curl -fL https://github.com/simstm/lazy-nevis/releases/download/v0.1.0-rc.1/install.sh -o install.sh
less install.sh
sh install.sh --prerelease
```

**Windows (PowerShell):**

```powershell
Invoke-WebRequest https://github.com/simstm/lazy-nevis/releases/download/v0.1.0-rc.1/install.ps1 -OutFile install.ps1
Get-Content .\install.ps1
.\install.ps1 -Prerelease
```

Pass `--version x.y.z-rc.N` (or `-Version`) together with `--prerelease` to pin to a specific RC version rather than selecting the latest available pre-release.

Use `--help` / `Get-Help .\install.ps1` for the full option reference: custom install directory, dry-run, non-interactive mode, and package format selection on Linux.

## Data Locations And Uninstall

Remove the app using Finder/Applications, Windows Installed Apps, or the Linux package manager; AppImage installs remove `~/.local/bin/lazynevis`, its desktop entry, and icon. Local data may remain under macOS `~/Library/Application Support/br.dev.sims.lazynevis*`, Windows `%APPDATA%`/`%LOCALAPPDATA%` for the LazyNevis identifier, or Linux `$XDG_DATA_HOME`/`~/.local/share` and `$XDG_CONFIG_HOME`/`~/.config`. Confirm the directory name before deletion. Exports and custom audio are never removed automatically.

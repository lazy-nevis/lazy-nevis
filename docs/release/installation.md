# Installation And Uninstall

Download only from `https://github.com/lazy-nevis/lazy-nevis/releases`. Verify `SHA256SUMS` before opening an artifact and use native signature checks plus `gh attestation verify <file> --repo lazy-nevis/lazy-nevis` when available.

## Install scripts

The install scripts download the correct artifact for your platform, verify the SHA-256 checksum, check GitHub build attestation, and run the native installer or place the binary.

### Stable release

**macOS / Linux:**

```bash
bash <(curl -fL https://raw.githubusercontent.com/SimStm/lazy-nevis/refs/heads/main/scripts/install.sh)
```

**Windows (PowerShell):**

```powershell
& ([scriptblock]::Create((iwr 'https://raw.githubusercontent.com/SimStm/lazy-nevis/refs/heads/main/scripts/install.ps1' -UseBasicParsing).Content))
```

### Pre-release / RC build

> **Note:** Pre-releases are **not** included in the `latest` URL. GitHub's `releases/latest` always resolves to the most recent stable (non-pre-release) release. Pass `--prerelease` / `-Prerelease` so the script selects the latest RC instead.

**macOS / Linux:**

```bash
bash <(curl -fL https://raw.githubusercontent.com/SimStm/lazy-nevis/refs/heads/main/scripts/install.sh) --prerelease
```

**Windows (PowerShell):**

```powershell
& ([scriptblock]::Create((iwr 'https://raw.githubusercontent.com/SimStm/lazy-nevis/refs/heads/main/scripts/install.ps1' -UseBasicParsing).Content)) -Prerelease
```

Pass `--version x.y.z-rc.N` (or `-Version`) together with `--prerelease` to pin to a specific RC version rather than selecting the latest available pre-release.

Use `--help` / `Get-Help .\install.ps1` for the full option reference: custom install directory, dry-run, and package format selection on Linux.

## Data Locations And Uninstall

Remove the app using Finder/Applications, Windows Installed Apps, or the Linux package manager; AppImage installs remove `~/.local/bin/lazynevis`, its desktop entry, and icon. Local data may remain under macOS `~/Library/Application Support/br.dev.sims.lazynevis*`, Windows `%APPDATA%`/`%LOCALAPPDATA%` for the LazyNevis identifier, or Linux `$XDG_DATA_HOME`/`~/.local/share` and `$XDG_CONFIG_HOME`/`~/.config`. Confirm the directory name before deletion. Exports and custom audio are never removed automatically.

# Installation And Uninstall

Download only from `https://github.com/simstm/lazy-nevis/releases`. Verify `SHA256SUMS` before opening an artifact and use native signature checks plus `gh attestation verify <file> --repo simstm/lazy-nevis` when available.

Recommended shell flow:

```bash
curl -fL https://github.com/simstm/lazy-nevis/releases/latest/download/install.sh -o install.sh
less install.sh
sh install.sh --dry-run
sh install.sh
```

Convenience flow (cannot authenticate the bootstrap script before execution):

```bash
curl -fsSL https://github.com/simstm/lazy-nevis/releases/latest/download/install.sh | sh
```

PowerShell:

```powershell
Invoke-WebRequest https://github.com/simstm/lazy-nevis/releases/latest/download/install.ps1 -OutFile install.ps1
Get-Content .\install.ps1
.\install.ps1 -DryRun
.\install.ps1
```

Use `--help`/`Get-Help` for pinned versions, prereleases, package choices, paths, and non-interactive operation.

## Data Locations And Uninstall

Remove the app using Finder/Applications, Windows Installed Apps, or the Linux package manager; AppImage installs remove `~/.local/bin/lazynevis`, its desktop entry, and icon. Local data may remain under macOS `~/Library/Application Support/br.dev.sims.lazynevis*`, Windows `%APPDATA%`/`%LOCALAPPDATA%` for the LazyNevis identifier, or Linux `$XDG_DATA_HOME`/`~/.local/share` and `$XDG_CONFIG_HOME`/`~/.config`. Confirm the directory name before deletion. Exports and custom audio are never removed automatically.

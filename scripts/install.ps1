[CmdletBinding()]
param(
  [ValidatePattern('^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$')][string]$Version,
  [switch]$Prerelease,
  [switch]$DryRun,
  [switch]$NonInteractive,
  [string]$InstallDir
)
$ErrorActionPreference = 'Stop'
$Repo = 'simstm/lazy-nevis'
$TemporaryDirectory = $null
$InstallSucceeded = $false

try {
  $architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
  if ($architecture -notin @('X64', 'Arm64')) { throw "Unsupported Windows architecture: $architecture" }
  $archName = if ($architecture -eq 'Arm64') { 'arm64' } else { 'x64' }
  $api = if ($Version) { "https://api.github.com/repos/$Repo/releases/tags/v$($Version.TrimStart('v'))" } else { "https://api.github.com/repos/$Repo/releases" }
  Write-Host "Resolving $(if ($Prerelease) {'prerelease'} else {'stable'}) for windows-$archName..."
  if ($DryRun) { Write-Host "Would query $api and require SHA256SUMS before installation."; return }

  $response = Invoke-RestMethod -Uri $api -Headers @{ Accept = 'application/vnd.github+json' }
  $releases = @($response) | Where-Object { -not $_.draft -and ($Prerelease -or -not $_.prerelease) }
  if ($Version) { $releases = @($releases | Where-Object tag_name -eq "v$($Version.TrimStart('v'))") }
  if ($releases.Count -ne 1 -and $Version) { throw 'Release selection was not unique.' }
  if ($releases.Count -eq 0) { throw 'No matching published release.' }
  $release = $releases[0]
  $assets = @($release.assets)
  $msiAssets = @($assets | Where-Object name -Match "windows-$archName.*\.msi$")
  $exeAssets = @($assets | Where-Object name -Match "windows-$archName.*\.exe$")
  $installer = if ($msiAssets.Count -eq 1) { $msiAssets } elseif ($msiAssets.Count -eq 0 -and $exeAssets.Count -eq 1) { $exeAssets } else { @() }
  $checksums = @($assets | Where-Object name -EQ 'SHA256SUMS')
  if ($installer.Count -ne 1 -or $checksums.Count -ne 1) { throw 'Installer or SHA256SUMS selection was not unique.' }
  foreach ($asset in @($installer[0], $checksums[0])) {
    if (-not $asset.browser_download_url.StartsWith("https://github.com/$Repo/releases/download/")) { throw 'Unofficial asset URL.' }
  }

  $TemporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("lazynevis-" + [guid]::NewGuid())
  [void](New-Item -ItemType Directory -Path $TemporaryDirectory)
  $installerPath = Join-Path $TemporaryDirectory $installer[0].name
  $sumsPath = Join-Path $TemporaryDirectory 'SHA256SUMS'
  Invoke-WebRequest -Uri $installer[0].browser_download_url -OutFile $installerPath
  Invoke-WebRequest -Uri $checksums[0].browser_download_url -OutFile $sumsPath
  $escaped = [regex]::Escape($installer[0].name)
  $entries = @(Get-Content $sumsPath | Where-Object { $_ -match "^([a-fA-F0-9]{64})\s+\*?$escaped$" })
  if ($entries.Count -ne 1) { throw 'Checksum entry missing or ambiguous.' }
  $expected = ([regex]::Match($entries[0], '^[a-fA-F0-9]{64}')).Value.ToLowerInvariant()
  $actual = (Get-FileHash -Algorithm SHA256 -Path $installerPath).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { throw 'SHA-256 mismatch.' }
  if (Get-Command gh -ErrorAction SilentlyContinue) {
    & gh attestation verify $installerPath --repo $Repo | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'GitHub attestation verification failed.' }
  }

  $signature = Get-AuthenticodeSignature -FilePath $installerPath
  if ($signature.Status -notin @('Valid', 'NotSigned')) { throw "Invalid Authenticode status: $($signature.Status)" }
  if ($signature.Status -eq 'NotSigned') { Write-Warning 'This RC is unsigned. Do not disable SmartScreen; follow docs/troubleshooting/smartscreen.md.' }

  $isMsi = [IO.Path]::GetExtension($installerPath) -eq '.msi'
  if ($isMsi) {
    $arguments = @('/i', $installerPath, '/norestart', '/L*v', (Join-Path $TemporaryDirectory 'install.log'))
    if ($NonInteractive) { $arguments += '/qn' }
    if ($InstallDir) { $arguments += "INSTALLDIR=$InstallDir" }
    $process = Start-Process msiexec.exe -ArgumentList $arguments -Wait -PassThru
  } else {
    $arguments = @(); if ($NonInteractive) { $arguments += '/S' }; if ($InstallDir) { $arguments += "/D=$InstallDir" }
    $process = Start-Process $installerPath -ArgumentList $arguments -Wait -PassThru
  }
  if ($process.ExitCode -notin @(0, 3010)) { throw "Installer failed with exit code $($process.ExitCode). Logs remain in $TemporaryDirectory" }
  $InstallSucceeded = $true
  Write-Host "LazyNevis $($release.tag_name) installed successfully (exit $($process.ExitCode))."
  if ($process.ExitCode -eq 3010) { exit 3010 }
} catch {
  Write-Error $_
  exit 1
} finally {
  if ($TemporaryDirectory -and (Test-Path $TemporaryDirectory)) {
    $log = Join-Path $TemporaryDirectory 'install.log'
    if (-not $InstallSucceeded -and (Test-Path $log)) { Copy-Item $log (Join-Path ([System.IO.Path]::GetTempPath()) 'LazyNevis-install.log') -Force }
    Remove-Item -Recurse -Force $TemporaryDirectory
  }
}

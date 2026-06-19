#!/bin/sh
set -eu

REPO="simstm/lazy-nevis"
INSTALLER_VERSION="1.0.0"
VERSION=""
PRERELEASE=0
DRY_RUN=0
NON_INTERACTIVE=0
INSTALL_DIR=""
PACKAGE=""
TMP_DIR=""

usage() {
  cat <<'EOF'
Usage: install.sh [options]
  --version SEMVER       Install an exact release (without or with v prefix)
  --prerelease           Permit/select a prerelease
  --package FORMAT       dmg, appimage, deb, or rpm (deb/rpm are explicit only)
  --install-dir PATH     Destination (/Applications, ~/Applications, or ~/.local/bin)
  --non-interactive      Use documented silent package flags; never answer sudo prompts
  --dry-run              Resolve and print actions without downloading/installing
  --help                 Show this help
Installer implementation version: 1.0.0
EOF
}

die() { printf 'error: %s\n' "$*" >&2; exit 1; }
cleanup() { [ -z "$TMP_DIR" ] || rm -rf "$TMP_DIR"; }
trap cleanup EXIT HUP INT TERM

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version) [ "$#" -ge 2 ] || die "--version requires SEMVER"; VERSION=${2#v}; shift 2 ;;
    --prerelease) PRERELEASE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --non-interactive) NON_INTERACTIVE=1; shift ;;
    --install-dir) [ "$#" -ge 2 ] || die "--install-dir requires PATH"; INSTALL_DIR=$2; shift 2 ;;
    --package) [ "$#" -ge 2 ] || die "--package requires FORMAT"; PACKAGE=$2; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

if [ -n "$VERSION" ] && ! printf '%s' "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'; then
  die "invalid semantic version: $VERSION"
fi
command -v curl >/dev/null 2>&1 || die "curl is required"
command -v python3 >/dev/null 2>&1 || die "python3 is required for strict GitHub JSON parsing"

OS=$(uname -s)
ARCH=$(uname -m)
case "$OS:$ARCH" in
  Darwin:arm64) PLATFORM=macos-arm64; [ -n "$PACKAGE" ] || PACKAGE=dmg; [ "$PACKAGE" = dmg ] || die "macOS supports dmg" ;;
  Linux:x86_64|Linux:amd64) PLATFORM=linux-x64; [ -n "$PACKAGE" ] || PACKAGE=appimage; case "$PACKAGE" in appimage|deb|rpm) ;; *) die "Linux supports appimage, deb, or rpm" ;; esac ;;
  *) die "unsupported system: $OS $ARCH" ;;
esac

[ "$PACKAGE" = deb ] && command -v dpkg >/dev/null 2>&1 || [ "$PACKAGE" != deb ] || die "dpkg is required for DEB"
[ "$PACKAGE" = rpm ] && command -v rpm >/dev/null 2>&1 || [ "$PACKAGE" != rpm ] || die "rpm is required for RPM"

if [ -n "$VERSION" ]; then
  API="https://api.github.com/repos/$REPO/releases/tags/v$VERSION"
else
  API="https://api.github.com/repos/$REPO/releases"
fi
printf 'Resolving %s release for %s (%s)...\n' "$([ "$PRERELEASE" -eq 1 ] && printf prerelease || printf stable)" "$PLATFORM" "$PACKAGE"
[ "$DRY_RUN" -eq 0 ] || { printf 'Would query %s and require SHA256SUMS before installation.\n' "$API"; exit 0; }

TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/lazynevis.XXXXXX") || die "cannot create secure temporary directory"
umask 077
JSON="$TMP_DIR/release.json"
curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 "$API" -o "$JSON"

case "$PACKAGE" in
  dmg) SUFFIX='macos-arm64.*\.dmg$' ;;
  appimage) SUFFIX='linux-x64.*\.AppImage$' ;;
  deb) SUFFIX='linux-x64.*\.deb$' ;;
  rpm) SUFFIX='linux-x64.*\.rpm$' ;;
esac

set -- $(python3 - "$JSON" "$VERSION" "$PRERELEASE" "$SUFFIX" <<'PY'
import json,re,sys
data=json.load(open(sys.argv[1], encoding="utf-8")); releases=data if isinstance(data,list) else [data]
version,allow,pattern=sys.argv[2],sys.argv[3]=="1",re.compile(sys.argv[4],re.I)
items=[r for r in releases if not r.get("draft") and (allow or not r.get("prerelease"))]
if version: items=[r for r in items if r.get("tag_name")=="v"+version]
if len(items)!=1 and version: raise SystemExit("release selection was not unique")
if not items: raise SystemExit("no matching published release")
r=items[0]; assets=r.get("assets",[])
matches=[a for a in assets if pattern.search(a.get("name",""))]
sums=[a for a in assets if a.get("name")=="SHA256SUMS"]; icons=[a for a in assets if a.get("name")=="app-icon.png"]
if len(matches)!=1 or len(sums)!=1 or len(icons)!=1: raise SystemExit("artifact, icon, or SHA256SUMS selection was not unique")
for a in (matches[0],sums[0],icons[0]):
 u=a.get("browser_download_url","")
 if not u.startswith("https://github.com/simstm/lazy-nevis/releases/download/"): raise SystemExit("unofficial asset URL")
print(r["tag_name"],matches[0]["name"],matches[0]["browser_download_url"],sums[0]["browser_download_url"],icons[0]["browser_download_url"])
PY
)
[ "$#" -eq 5 ] || die "release metadata parsing failed"
TAG=$1; ASSET_NAME=$2; ASSET_URL=$3; SUMS_URL=$4; ICON_URL=$5
ASSET="$TMP_DIR/$ASSET_NAME"; SUMS="$TMP_DIR/SHA256SUMS"
curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 "$SUMS_URL" -o "$SUMS"
curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 "$ASSET_URL" -o "$ASSET"

EXPECTED=$(awk -v file="$ASSET_NAME" '$2 == file || $2 == "*" file { if (found++) exit 2; print $1 } END { if (found != 1) exit 3 }' "$SUMS") || die "checksum entry missing or ambiguous"
case "$OS" in Darwin) ACTUAL=$(shasum -a 256 "$ASSET" | awk '{print $1}') ;; *) ACTUAL=$(sha256sum "$ASSET" | awk '{print $1}') ;; esac
[ "$EXPECTED" = "$ACTUAL" ] || die "SHA-256 mismatch for $ASSET_NAME"
if command -v gh >/dev/null 2>&1; then gh attestation verify "$ASSET" --repo "$REPO" >/dev/null || die "GitHub attestation verification failed"; fi
printf 'Verified %s from %s.\n' "$ASSET_NAME" "$TAG"

if [ "$PACKAGE" = dmg ]; then
  DEST=${INSTALL_DIR:-/Applications}
  [ ! -e "$DEST/LazyNevis.app" ] || printf 'Existing installation detected; it will be upgraded after verification.\n'
  MOUNT="$TMP_DIR/mount"; mkdir "$MOUNT"
  hdiutil attach "$ASSET" -nobrowse -readonly -mountpoint "$MOUNT" >/dev/null
  APP=$(find "$MOUNT" -maxdepth 1 -type d -name '*.app' -print)
  [ "$(printf '%s\n' "$APP" | grep -c .)" -eq 1 ] || die "DMG must contain exactly one app"
  if [ -w "$DEST" ]; then ditto "$APP" "$DEST/LazyNevis.app"
  else
    [ "$NON_INTERACTIVE" -eq 0 ] || die "$DEST requires an interactive administrator prompt"
    printf '%s requires administrator permission; macOS will show its normal password prompt.\n' "$DEST"
    sudo ditto "$APP" "$DEST/LazyNevis.app"
  fi
  hdiutil detach "$MOUNT" >/dev/null
  codesign --verify --deep --strict "$DEST/LazyNevis.app" 2>/dev/null || printf 'Warning: this RC is not Developer ID signed. Follow docs/troubleshooting/gatekeeper.md; never disable Gatekeeper.\n'
elif [ "$PACKAGE" = appimage ]; then
  DEST=${INSTALL_DIR:-"$HOME/.local/bin"}; mkdir -p "$DEST" "$HOME/.local/share/applications" "$HOME/.local/share/icons/hicolor/256x256/apps"
  [ ! -e "$DEST/lazynevis" ] || printf 'Existing installation detected; it will be upgraded after verification.\n'
  cp "$ASSET" "$DEST/lazynevis"; chmod 0755 "$DEST/lazynevis"
  ICON="$TMP_DIR/app-icon.png"
  curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 "$ICON_URL" -o "$ICON"
  ICON_EXPECTED=$(awk '$2 == "app-icon.png" || $2 == "*app-icon.png" { if (found++) exit 2; print $1 } END { if (found != 1) exit 3 }' "$SUMS") || die "icon checksum missing or ambiguous"
  ICON_ACTUAL=$(sha256sum "$ICON" | awk '{print $1}')
  [ "$ICON_EXPECTED" = "$ICON_ACTUAL" ] || die "SHA-256 mismatch for app-icon.png"
  cp "$ICON" "$HOME/.local/share/icons/hicolor/256x256/apps/lazynevis.png"
  DESKTOP="$HOME/.local/share/applications/lazynevis.desktop"
  printf '[Desktop Entry]\nType=Application\nName=LazyNevis\nExec=%s\nIcon=lazynevis\nCategories=Utility;Productivity;\nTerminal=false\n' "$DEST/lazynevis" > "$DESKTOP"
  chmod 0644 "$DESKTOP"
elif [ "$PACKAGE" = deb ]; then
  [ "$NON_INTERACTIVE" -eq 0 ] || die "DEB installation requires an administrator prompt"
  printf 'DEB installation requires administrator permission; sudo will show its normal prompt.\n'; sudo dpkg -i "$ASSET"
else
  [ "$NON_INTERACTIVE" -eq 0 ] || die "RPM installation requires an administrator prompt"
  printf 'RPM installation requires administrator permission; sudo will show its normal prompt.\n'; sudo rpm -U "$ASSET"
fi
printf 'LazyNevis %s installed successfully.\n' "$TAG"

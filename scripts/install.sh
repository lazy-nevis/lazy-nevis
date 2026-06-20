#!/bin/sh
set -eu

REPO="SimStm/lazy-nevis"
VERSION=""
PRERELEASE=0
DRY_RUN=0
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
  --dry-run              Resolve and print actions without downloading/installing
  --help                 Show this help
Installer implementation version: 1.1.0
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
  dmg)      SUFFIX='macos-arm64.*[.]dmg$' ;;
  appimage) SUFFIX='linux-x64.*[.]appimage$' ;;
  deb)      SUFFIX='linux-x64.*[.]deb$' ;;
  rpm)      SUFFIX='linux-x64.*[.]rpm$' ;;
esac

METADATA=$(awk \
  -v ver="$VERSION" \
  -v allow="$PRERELEASE" \
  -v suffix="$SUFFIX" \
  -v pfx="https://github.com/simstm/lazy-nevis/releases/download/" \
  'BEGIN { bd=0; in_a=0; rel_tag=""; rel_d="false"; rel_p="false"
           asset_nm=""; asset_u=""; out_tag=""; out_nm=""; out_u=""
           out_sums=""; out_icon=""; mc=0; sc=0; ic=0; done=0 }
   done { next }
   /^[[:space:]]*\{[[:space:]]*$/ {
     bd++
     if (bd==1) { rel_tag=""; rel_d="false"; rel_p="false"; in_a=0
                  out_nm=""; out_u=""; out_sums=""; out_icon=""; mc=0; sc=0; ic=0 }
     else if (bd==2 && in_a) { asset_nm=""; asset_u="" }
     next
   }
   /^[[:space:]]*\}[,]?[[:space:]]*$/ {
     if (bd==2 && in_a) {
       if (asset_nm!="" && tolower(asset_nm)~suffix && asset_u!="") { mc++; out_nm=asset_nm; out_u=asset_u }
       if (asset_nm=="SHA256SUMS" && asset_u!="") { sc++; out_sums=asset_u }
       if (asset_nm=="app-icon.png" && asset_u!="") { ic++; out_icon=asset_u }
       asset_nm=""; asset_u=""
     } else if (bd==1) {
       if (rel_d!="true" && (allow=="1"||rel_p!="true") && (ver==""||rel_tag=="v"ver)) {
         if (mc!=1||sc!=1||ic!=1) { print "artifact/icon/SHA256SUMS count not unique" > "/dev/stderr"; exit 1 }
         if (index(tolower(out_u),pfx)!=1||index(tolower(out_sums),pfx)!=1||index(tolower(out_icon),pfx)!=1) {
           print "unofficial asset URL" > "/dev/stderr"; exit 1
         }
         out_tag=rel_tag; done=1
       }
     }
     bd--; next
   }
   /^[[:space:]]*\][,]?[[:space:]]*$/ { if (in_a && bd==1) in_a=0; next }
   bd==1 && !in_a {
     if      (/^[[:space:]]*"tag_name"[[:space:]]*:/)  { v=$0; sub(/.*:[[:space:]]*"/,"",v); sub(/".*$/,"",v); rel_tag=v }
     else if (/^[[:space:]]*"draft"[[:space:]]*:/)      { v=$0; sub(/.*:[[:space:]]*/,"",v); sub(/[,[:space:]]*$/,"",v); rel_d=v }
     else if (/^[[:space:]]*"prerelease"[[:space:]]*:/) { v=$0; sub(/.*:[[:space:]]*/,"",v); sub(/[,[:space:]]*$/,"",v); rel_p=v }
     else if (/^[[:space:]]*"assets"[[:space:]]*:/)     { in_a=1 }
   }
   bd==2 && in_a {
     if      (/^[[:space:]]*"name"[[:space:]]*:/)                 { v=$0; sub(/.*:[[:space:]]*"/,"",v); sub(/".*$/,"",v); asset_nm=v }
     else if (/^[[:space:]]*"browser_download_url"[[:space:]]*:/) { v=$0; sub(/.*:[[:space:]]*"/,"",v); sub(/".*$/,"",v); asset_u=v }
   }
   END { if (!done) { print "no matching published release" > "/dev/stderr"; exit 1 }
         printf "%s\t%s\t%s\t%s\t%s\n", out_tag, out_nm, out_u, out_sums, out_icon }' \
  "$JSON")
IFS="$(printf '\t')" read -r TAG ASSET_NAME ASSET_URL SUMS_URL ICON_URL <<EOF
$METADATA
EOF
[ -n "$TAG" ] && [ -n "$ASSET_NAME" ] && [ -n "$ASSET_URL" ] && [ -n "$SUMS_URL" ] && [ -n "$ICON_URL" ] \
  || die "release metadata parsing failed"
ASSET="$TMP_DIR/$ASSET_NAME"; SUMS="$TMP_DIR/SHA256SUMS"
curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 "$SUMS_URL" -o "$SUMS"
curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 "$ASSET_URL" -o "$ASSET"

EXPECTED=$(awk -v file="$ASSET_NAME" '$2 == file || $2 == "*" file { if (found++) exit 2; print $1 } END { if (found != 1) exit 3 }' "$SUMS") || die "checksum entry missing or ambiguous"
case "$OS" in Darwin) ACTUAL=$(shasum -a 256 "$ASSET" | awk '{print $1}') ;; *) ACTUAL=$(sha256sum "$ASSET" | awk '{print $1}') ;; esac
[ "$EXPECTED" = "$ACTUAL" ] || die "SHA-256 mismatch for $ASSET_NAME"
if command -v gh >/dev/null 2>&1; then gh attestation verify "$ASSET" --repo "$REPO" >/dev/null || die "GitHub attestation verification failed"; fi
printf 'Verified %s from %s.\n' "$ASSET_NAME" "$TAG"

INSTALL_PATH=""
if [ "$PACKAGE" = dmg ]; then
  DEST=${INSTALL_DIR:-/Applications}
  [ ! -e "$DEST/LazyNevis.app" ] || printf 'Existing installation detected; it will be upgraded.\n'
  MOUNT="$TMP_DIR/mount"; mkdir "$MOUNT"
  hdiutil attach "$ASSET" -nobrowse -readonly -mountpoint "$MOUNT" >/dev/null
  APP=$(find "$MOUNT" -maxdepth 1 -type d -name '*.app' -print)
  [ "$(printf '%s\n' "$APP" | grep -c .)" -eq 1 ] || die "DMG must contain exactly one app"
  if [ -w "$DEST" ]; then ditto "$APP" "$DEST/LazyNevis.app"
  else
    printf '%s requires administrator permission; macOS will show its normal password prompt.\n' "$DEST"
    sudo ditto "$APP" "$DEST/LazyNevis.app"
  fi
  hdiutil detach "$MOUNT" >/dev/null
  xattr -cr "$DEST/LazyNevis.app" 2>/dev/null || true
  INSTALL_PATH="$DEST/LazyNevis.app"
elif [ "$PACKAGE" = appimage ]; then
  DEST=${INSTALL_DIR:-"$HOME/.local/bin"}; mkdir -p "$DEST" "$HOME/.local/share/applications" "$HOME/.local/share/icons/hicolor/256x256/apps"
  [ ! -e "$DEST/lazynevis" ] || printf 'Existing installation detected; it will be upgraded.\n'
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
  INSTALL_PATH="$DEST/lazynevis"
elif [ "$PACKAGE" = deb ]; then
  printf 'DEB installation requires administrator permission; sudo will show its normal prompt.\n'
  DEBIAN_FRONTEND=noninteractive sudo dpkg -i "$ASSET"
  INSTALL_PATH="/usr/bin/lazynevis"
else
  printf 'RPM installation requires administrator permission; sudo will show its normal prompt.\n'
  sudo rpm -U "$ASSET"
  INSTALL_PATH="/usr/bin/lazynevis"
fi
printf 'LazyNevis %s installed successfully.\n' "$TAG"
printf 'Installed to: %s\n' "$INSTALL_PATH"

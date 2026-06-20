# Code Signing: What Needs to Happen

LazyNevis currently ships unsigned RC artifacts. Stable releases will require code signing and notarization to pass macOS Gatekeeper and Windows SmartScreen without user intervention.

This document records exactly what is needed when the time comes.

---

## Current behavior

- **RC builds** skip signing gracefully. CI checks that credentials are absent and proceeds without them.
- **Stable builds** require signing. The CI verification step will fail if the expected secrets are not present.
- Users on RC builds follow the documented Gatekeeper/SmartScreen bypass flows described in the troubleshooting docs.

---

## macOS

**Program:** Apple Developer Program, $99/year, [developer.apple.com](https://developer.apple.com).

**What to obtain:**

1. Enroll in the Apple Developer Program under the project's individual or organization account.
2. Create a **Developer ID Application** certificate in Xcode or the Developer Portal. Export it as a `.p12` file with a strong passphrase.
3. Create an **App Store Connect API key** (type: Developer) for notarization. This yields a `.p8` private key file, a key ID, and an issuer ID.

**GitHub secrets required (Settings > Environments > release):**

| Secret | Content |
|---|---|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Passphrase for the `.p12` |
| `APPLE_SIGNING_IDENTITY` | Full identity string, e.g. `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_API_KEY` | Contents of the `.p8` private key file |
| `APPLE_API_KEY_ID` | Key ID from App Store Connect |
| `APPLE_API_ISSUER` | Issuer ID from App Store Connect |

Tauri's `tauri-action` reads these automatically. The notarization step submits the DMG to Apple and waits for approval (typically 2-5 minutes). Notarized builds pass Gatekeeper on first launch with no user workaround needed.

---

## Windows

**Primary option (free for open-source):** SignPath Foundation at [signpath.io](https://signpath.io). Provides OV-equivalent Authenticode signing for qualifying open-source projects at no cost.

**Alternative:** Purchase an OV (Organization Validation) or EV (Extended Validation) certificate from a Microsoft-trusted CA (e.g., DigiCert, Sectigo). EV certificates build SmartScreen reputation immediately; OV certificates require volume to accumulate reputation.

**GitHub secrets required (Settings > Environments > release):**

| Secret | Content |
|---|---|
| `WINDOWS_CERTIFICATE` | Base64-encoded PFX/P12 certificate |
| `WINDOWS_CERTIFICATE_PASSWORD` | Passphrase for the certificate |

Tauri's `tauri-action` reads these automatically and signs the NSIS and MSI installers before upload.

---

## Where to put secrets

All signing secrets belong in a **GitHub Actions environment** named `release`:

1. Go to the repository **Settings > Environments**.
2. Create (or open) the environment named `release`.
3. Add each secret listed above under **Environment secrets**.
4. The release workflow already references this environment; no workflow changes are needed.

Keep the `.p12`, `.p8`, and PFX files encrypted and off-repository at all times. Rotate them if they are ever exposed.

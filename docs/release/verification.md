# Release Verification

1. Download the artifact and `SHA256SUMS` from the same GitHub release.
2. Run `sha256sum -c SHA256SUMS --ignore-missing` (Linux), `shasum -a 256 -c SHA256SUMS` (macOS, for the selected line), or `Get-FileHash -Algorithm SHA256` (Windows).
3. On macOS run `codesign --verify --deep --strict <app>` and `spctl --assess --type execute <app>`; signed releases also use `xcrun stapler validate`.
4. On Windows inspect `Get-AuthenticodeSignature <installer>` and require `Valid` for a release advertised as signed.
5. With GitHub CLI run `gh attestation verify <artifact> --repo lazy-nevis/lazy-nevis`.

Checksums are created only after native signing/notarization is complete. The release notes state whether each native signature is present. SBOM files use CycloneDX JSON.

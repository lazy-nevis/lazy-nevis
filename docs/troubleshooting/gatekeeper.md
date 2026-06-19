# macOS Gatekeeper

Stable releases should be Developer ID signed and notarized. An explicitly labeled unsigned RC can trigger Gatekeeper. Use Apple's supported flow: try opening once, then System Settings > Privacy & Security > Open Anyway, verify the displayed app identity, and confirm. Never disable Gatekeeper, run `xattr` removal commands, or alter system security policy for LazyNevis. Prefer a signed build when available.

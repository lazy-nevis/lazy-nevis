# Known Limitations

- Linux behavior varies by desktop, display server, WebKitGTK, tray implementation, and idle/window APIs.
- Clean-machine acceptance is required for every published artifact; a successful build on another OS is not equivalent to that manual test.
- At 200% scaling or the 640x480 minimum window, dense Settings and large History views require scrolling.
- RC artifacts may be unsigned until Apple and Windows identities are configured; follow Gatekeeper/SmartScreen documentation.
- Automatic update installation, background update checks, Alpine, Linux ARM64, macOS x64, stores, and package-manager channels are not currently promised.

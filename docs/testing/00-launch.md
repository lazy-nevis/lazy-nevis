# 00 — Launch and runtime guard

**Setup:** quit any running LazyNevis dev instance.

1. Run `bun tauri dev`. **Expected:** the main window opens on the Dashboard with no error toast.
2. Open `http://localhost:1420` in a regular browser tab. **Expected:** a notice saying the page
   needs the desktop app; no app UI renders and nothing loads indefinitely.
3. In the app, open Settings → General, change the language, wait 1 s, restart `bun tauri dev`.
   **Expected:** the language persists and no other setting reverted to its default.
4. Restart while the app is still loading (quit within ~1 s of launch). **Expected:** on the next
   launch all settings are intact (saves before load are ignored).

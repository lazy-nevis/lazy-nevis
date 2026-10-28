# 01 — Window geometry and drag region

**Setup:** app running in Full Mode.

1. Resize the window to roughly 1100×750 and move it to a corner. Wait 1 s, quit (⌘Q), relaunch.
   **Expected:** same size and position.
2. Switch to Compact Mode. Resize/move it somewhere else, quit, relaunch. **Expected:** Compact
   Mode reopens with its own geometry.
3. Switch back to Full Mode. **Expected:** Full Mode geometry from step 1, not the compact one.
4. Enter native fullscreen, quit, relaunch. **Expected:** the windowed geometry (not the
   fullscreen frame) is restored.
5. Drag the window by the empty area of the content header and by the breadcrumb text.
   **Expected:** the window moves; buttons in the header still click normally.

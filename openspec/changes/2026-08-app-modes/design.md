# Design: Full / Compact App Modes

## State & broadcast (Rust owns the canonical status — RTK.md boundaries)

`AppStatusManager` gains `mode: AppMode (Full|Compact)` and `pinned: bool`;
`snapshot() -> AppStatusPayload { mode, pinned, session: { state, elapsed_ms } }`. Every mutator
ends with `app.emit("app:status", snapshot)`. Windows hydrate with `get_app_status` and listen to
the event — no window guesses state.

## Settings

`AppModeSettings { mode: "full", pinned: false, full_geometry: Option<Geometry>,
compact_geometry: Option<Geometry> }` with `Geometry { x, y, width, height }` (physical px),
`#[serde(default)]`, validated. **Single writer:** `set_app_mode` / `set_window_pin` persist the
section directly and emit `settings:changed`; `save_settings` overwrites the incoming `app_mode`
section with the in-memory one, so the frontend can never clobber it via the debounced save.

## Commands (`commands/app_mode.rs`)

- `get_app_status() -> AppStatusPayload`.
- `set_app_mode(mode)` — captures current main-window geometry into the outgoing mode's slot
  (pure helper `store_geometry`), applies the incoming mode: `set_min_size` (compact 320×560,
  full 640×480), `set_size`/`set_position` from the saved slot (defaults compact 360×720, full
  900×680 centered), `set_always_on_top(pinned && compact)`, persists, broadcasts.
- `set_window_pin(pinned)` — `set_always_on_top(pinned && compact)`, persists, broadcasts.
- `open_secondary_window(pane ∈ {settings, history, checklist-history})` — create-or-reuse
  window labeled `secondary` at `#/secondary?pane=<pane>` (900×680, decorated, closable); when it
  already exists, `emit_to("secondary", "secondary:navigate", { pane })` + show + focus.
  Capability `capabilities/secondary.json` (`core:default`, `allow-hide`, `allow-close`).
- Startup applies the persisted mode via the same code path before showing the window;
  `tauri.conf.json` min drops to 320×480 (real minimums enforced at runtime per mode).

## Frontend

- `appStatusStore` + `useAppStatus` (hydrate + `app:status` listener; usable in any window).
- `AppShell` keeps the single `useFocusSession` and branches by mode: full → current layout;
  compact → `CompactShell` (top bar: settings/mode-toggle/pin; session block via `sessionStore`
  + `sessionService` — same pattern as `CloseWarningDialog`, no second `useFocusSession`;
  checklist block reuses Phase-1 components in compact form). Toasts/dialogs/prompts render in
  both modes.
- `RootRoutes` gains `/secondary` → `SecondaryShell` (no AppShell): reads `?pane=`, listens
  `secondary:navigate`, renders the existing lazy `Settings`/`History` pages and the checklist
  history component. Settings edits propagate back through `settings:changed` (the settings
  store in each window applies it).
- Theme sync is extracted into a shared `useThemeSync` used by AppShell, TrayPopover, and
  SecondaryShell so every window follows the theme.
- Names in UI copy: **Full Mode / Compact Mode** (pt-BR: Modo Completo / Modo Compacto).
- macOS overlay title bar: native traffic lights are repositioned via `trafficLightPosition`
  (main window config) and `WebviewWindowBuilder::traffic_light_position` (secondary window),
  currently `{x: 16, y: 20}` in both places (must stay in sync — bump if the header height
  ever changes from `TitleBar.tsx`'s `h-9` / 36px). This is purely a native macOS window-chrome
  setting: it only takes effect when the window is first created, so a code change requires a
  full quit of the running app (not just closing/reopening — the app hides to tray instead of
  exiting) and a fresh `tauri dev` launch to see it, and its exact value is a visual judgment
  call that needs a real macOS window to eyeball, not something derivable from code alone.
- Title text is window-centered (`absolute inset-0 flex justify-center`), not tucked next to the
  traffic lights — this matches how native macOS title bars behave and sidesteps needing the
  title's horizontal position to track the traffic-light cluster width at all.
- **Single native window, one traffic-light position for both modes.** Full and Compact Mode
  render inside the same "main" `WebviewWindow` (only the React layout changes) — macOS's
  `traffic_light_position` is a window-chrome property applied once at window creation, and the
  public Tauri 2.11 Rust API exposes no runtime setter to change it per-mode without destroying
  and recreating the native window (too disruptive for a cosmetic offset: it would drop the
  `useFocusSession` owner, active timers, and flash blank on every mode switch). The practical
  fix is giving both headers (`TitleBar.tsx` and `CompactShell`'s top bar) the **same height**
  (`h-9`, 36px) so one offset value serves both correctly, rather than trying to track two
  positions that don't exist at the native layer.
- **Fullscreen follows Full Mode** (`app_status.rs::next_fullscreen_transition`, pure and unit
  tested): native macOS fullscreen (the green traffic-light button) has no dedicated Tauri
  `WindowEvent` — detected by checking `window.is_fullscreen()` on every `Resized` event for the
  "main" window (`lib.rs`'s `on_window_event`). Entering fullscreen while in Compact Mode flips
  the **in-memory** `AppStatusManager` mode to Full (never persisted, never touches window
  geometry) so the fullscreen window gets the large-screen layout instead of the narrow compact
  column stretched across the screen; exiting restores whichever mode was active before. Both
  mode-toggle buttons (Sidebar's compact toggle, CompactShell's expand-to-full button) hide
  while `is_fullscreen` is true, since triggering a real mode switch (which resizes/repositions
  the window) while the OS owns the window's fullscreen state is undefined behavior worth
  avoiding rather than handling.

## Rollback

Additive; reverting leaves an unused `app_mode` section in stored settings (deserialized and
ignored by older builds thanks to `#[serde(default)]` round-tripping).

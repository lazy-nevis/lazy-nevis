/**
 * Cross-window "open Settings on tab X" hand-off. All windows share one origin, so a
 * localStorage key reaches a Settings pane that is already open (via the `storage`
 * event) as well as one that mounts afterwards (via `consumeSettingsTab`).
 */
import { emit } from "@tauri-apps/api/event";

const KEY = "lazynevis:settings-tab";
/** Tauri event for a Settings pane that is already mounted (`storage` events do not reliably cross webviews). */
export const SETTINGS_TAB_EVENT = "settings:open-tab";

export function requestSettingsTab(tab: string): void {
  try {
    localStorage.setItem(KEY, tab);
  } catch {
    // storage unavailable: Settings just opens on its default tab
  }
  void emit(SETTINGS_TAB_EVENT, tab).catch(() => undefined);
}

/** Reads and clears a pending request. */
export function consumeSettingsTab(): string | null {
  try {
    const tab = localStorage.getItem(KEY);
    if (tab) localStorage.removeItem(KEY);
    return tab;
  } catch {
    return null;
  }
}

export const SETTINGS_TAB_STORAGE_KEY = KEY;

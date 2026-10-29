/**
 * Cross-window "open Settings on tab X" hand-off. All windows share one origin, so a
 * localStorage key reaches a Settings pane that is already open (via the `storage`
 * event) as well as one that mounts afterwards (via `consumeSettingsTab`).
 */
const KEY = "lazynevis:settings-tab";

export function requestSettingsTab(tab: string): void {
  try {
    localStorage.setItem(KEY, tab);
  } catch {
    // storage unavailable: Settings just opens on its default tab
  }
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

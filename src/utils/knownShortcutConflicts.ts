// Curated list of key combinations widely reserved by other applications or the OS.
// Values are product names (data, not translatable copy); the warning sentence itself
// comes from i18n (settings.shortcuts.conflict_warning).
// Spec: global-shortcuts/choosing-a-risky-combination.
const KNOWN_CONFLICTS: Record<string, string> = {
  "cmdorctrl+shift+f": "VS Code, JetBrains, Figma",
  "cmdorctrl+shift+s": "Photoshop, Word, Excel, Figma",
  "cmdorctrl+shift+c": "Chrome DevTools, Discord, Figma",
  "cmdorctrl+shift+o": "VS Code, Chrome, Lightroom",
  "cmdorctrl+shift+p": "VS Code, Chrome, Firefox",
  "cmdorctrl+shift+n": "Chrome, Firefox, Finder, Explorer",
  "cmdorctrl+shift+t": "Chrome, Firefox, VS Code",
  "cmdorctrl+shift+a": "Chrome, Android Studio, Slack",
  "cmdorctrl+shift+e": "VS Code, Firefox",
  "cmdorctrl+shift+3": "macOS (screenshot)",
  "cmdorctrl+shift+4": "macOS (screenshot)",
  "cmdorctrl+shift+5": "macOS (screen recording)",
  "cmdorctrl+alt+i": "Chrome DevTools",
  "cmdorctrl+space": "macOS Spotlight, input switching",
};

function normalize(shortcut: string): string {
  const parts = shortcut
    .toLowerCase()
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) =>
      part === "cmd" || part === "ctrl" || part === "commandorcontrol" || part === "command" || part === "control"
        ? "cmdorctrl"
        : part,
    );
  if (parts.length < 2) return parts.join("+");
  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1).sort();
  return [...mods, key].join("+");
}

/**
 * Returns the product names known to use this combination, or null when the
 * combination is not on the curated list.
 */
export function findKnownConflict(shortcut: string): string | null {
  if (!shortcut.trim()) return null;
  return KNOWN_CONFLICTS[normalize(shortcut)] ?? null;
}

import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";
import { useTranslation } from "react-i18next";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

// Keys that cannot be used as the main key of a hotkey
const FORBIDDEN_KEYS = new Set([
  "Escape", "Enter", "Return", "Backspace", "Delete", "Tab",
  "Space", " ", "CapsLock", "ScrollLock", "NumLock", "PrintScreen",
  "Pause", "Insert", "Home", "End", "PageUp", "PageDown",
  "ContextMenu", "Unidentified",
]);

// Modifier key names (not valid as standalone key)
const MODIFIER_KEYS = new Set(["Control", "Meta", "Alt", "Shift", "OS", "Super"]);

/** Convert a KeyboardEvent to a Tauri-compatible shortcut string. */
function buildShortcut(e: KeyboardEvent): string | null {
  if (FORBIDDEN_KEYS.has(e.key) || MODIFIER_KEYS.has(e.key)) return null;

  const parts: string[] = [];

  // Platform-agnostic modifier
  if (e.ctrlKey || e.metaKey) parts.push("CmdOrCtrl");
  else if (e.ctrlKey) parts.push("Ctrl");

  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  // Must have at least one modifier
  if (parts.length === 0) return null;

  // Normalize key name
  let key = e.key;
  if (key.length === 1) key = key.toUpperCase();
  // Special keys
  const keyMap: Record<string, string> = {
    ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
    F1: "F1", F2: "F2", F3: "F3", F4: "F4", F5: "F5",
    F6: "F6", F7: "F7", F8: "F8", F9: "F9", F10: "F10", F11: "F11", F12: "F12",
  };
  key = keyMap[key] ?? key;

  parts.push(key);
  return parts.join("+");
}

/** Display a Tauri shortcut string in a user-friendly way (platform-aware). */
function displayShortcut(shortcut: string): string {
  const isMac = navigator.platform.toLowerCase().includes("mac");
  return shortcut
    .replace("CmdOrCtrl", isMac ? "⌘" : "Ctrl")
    .replace("Shift", "⇧")
    .replace("Alt", isMac ? "⌥" : "Alt")
    .replace(/\+/g, " ");
}

export function HotkeyInput({ value, onChange, disabled, placeholder, className }: Props) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [partial, setPartial] = useState(""); // shows while modifiers are held
  const inputRef = useRef<HTMLButtonElement>(null);

  const startRecording = () => {
    if (disabled) return;
    setRecording(true);
    setPartial("");
    inputRef.current?.focus();
  };

  const stopRecording = useCallback(() => {
    setRecording(false);
    setPartial("");
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!recording) return;
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        stopRecording();
        return;
      }

      // Show partial state while modifiers are being held
      if (MODIFIER_KEYS.has(e.key)) {
        const mods: string[] = [];
        const isMac = navigator.platform.toLowerCase().includes("mac");
        if (e.ctrlKey || e.metaKey) mods.push(isMac ? "⌘" : "Ctrl");
        if (e.altKey) mods.push(isMac ? "⌥" : "Alt");
        if (e.shiftKey) mods.push("⇧");
        setPartial(mods.join(" ") + " …");
        return;
      }

      const shortcut = buildShortcut(e);
      if (shortcut) {
        onChange(shortcut);
        stopRecording();
      } else {
        // Invalid key — show feedback briefly
        setPartial("⚠ Invalid key");
        setTimeout(() => setPartial(""), 700);
      }
    },
    [recording, onChange, stopRecording]
  );

  useEffect(() => {
    if (!recording) return;
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recording, handleKeyDown]);

  // Click outside cancels recording
  useEffect(() => {
    if (!recording) return;
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        stopRecording();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [recording, stopRecording]);

  const displayValue = recording
    ? (partial || "Press a key combination…")
    : value
    ? displayShortcut(value)
    : placeholder ?? t("settings.shortcuts.disabled_placeholder");

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={inputRef}
        type="button"
        disabled={disabled}
        onClick={startRecording}
        className={cn(
          "h-9 min-w-52 rounded-md border px-3 text-sm font-mono text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          recording
            ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
            : "border-input bg-transparent hover:border-primary/50",
          className
        )}
      >
        <span
          className={cn(
            "block truncate",
            recording && "animate-pulse"
          )}
        >
          {displayValue}
        </span>
      </button>

      {/* Cancel button shown while recording */}
      {recording && (
        <button
          type="button"
          onClick={stopRecording}
          className="absolute right-2 flex items-center justify-center w-5 h-5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title={t("common.cancel")}
          aria-label={t("common.cancel")}
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Clear (disable) button — empty binding means the shortcut is disabled */}
      {!recording && !disabled && value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 flex items-center justify-center w-5 h-5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title={t("settings.shortcuts.clear")}
          aria-label={t("settings.shortcuts.clear")}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

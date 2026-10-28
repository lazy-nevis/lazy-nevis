import { useEffect } from "react";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { useUiStore } from "@/stores/uiStore";
import { isEditableElement, isModKey } from "@/utils/hotkeys";

/** Main-window shortcuts: Mod+K (palette), Mod+B (sidebar). */
export function useShellHotkeys() {
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const { toggleCollapsed } = useSidebarCollapsed();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isModKey(e)) return;
      if (isEditableElement(e.target)) return;

      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      } else if (key === "b") {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setCommandPaletteOpen, toggleCollapsed]);
}

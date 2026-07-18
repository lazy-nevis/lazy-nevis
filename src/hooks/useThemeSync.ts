import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Applies the theme setting to the document root. Every window root uses this
 * (AppShell, tray panel, secondary window) so all surfaces follow the theme.
 */
export function useThemeSync() {
  const theme = useSettingsStore((s) => s.settings.general.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      return;
    }
    if (theme === "light") {
      root.classList.remove("dark");
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    root.classList.toggle("dark", mq.matches);
    const handler = (e: MediaQueryListEvent) => root.classList.toggle("dark", e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);
}

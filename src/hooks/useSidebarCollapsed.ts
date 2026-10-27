import { useCallback } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useSettings } from "@/hooks/useSettings";

/** Persisted collapse preference plus narrow-window override (< 900px). */
export function useSidebarCollapsed() {
  const { settings, saveSettings } = useSettings();
  const isNarrow = useMediaQuery("(max-width: 899px)");
  const savedCollapsed = settings.ui.sidebar_collapsed;
  const effectiveCollapsed = isNarrow || savedCollapsed;

  const toggleCollapsed = useCallback(() => {
    saveSettings(
      {
        ...settings,
        ui: { ...settings.ui, sidebar_collapsed: !settings.ui.sidebar_collapsed },
      },
      { silent: true },
    );
  }, [settings, saveSettings]);

  const setCollapsed = useCallback(
    (collapsed: boolean) => {
      if (settings.ui.sidebar_collapsed === collapsed) return;
      saveSettings(
        {
          ...settings,
          ui: { ...settings.ui, sidebar_collapsed: collapsed },
        },
        { silent: true },
      );
    },
    [settings, saveSettings],
  );

  return {
    isNarrow,
    savedCollapsed,
    effectiveCollapsed,
    toggleCollapsed,
    setCollapsed,
  };
}

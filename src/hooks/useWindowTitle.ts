import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/**
 * Keeps the native window title as "LazyNevis — <screen>" (matching the em-dash
 * style of the tray tooltip). Pass the already-localized screen name; the title
 * re-applies on language change. Spec: app-modes/window-titles.
 */
export function useWindowTitle(screen: string) {
  const { t } = useTranslation();
  const title = t("app.window_title", { screen });

  useEffect(() => {
    import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => getCurrentWindow().setTitle(title))
      .catch(() => {
        /* not running inside Tauri (tests) */
      });
  }, [title]);
}

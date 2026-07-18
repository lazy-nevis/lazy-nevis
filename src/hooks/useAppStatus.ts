import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { appModeService } from "@/services/tauri";
import { useAppStatusStore } from "@/stores/appStatusStore";
import type { AppStatusPayload } from "@/types";

/**
 * Hydrates and follows the Rust status broadcast; safe in any window
 * (spec: app-modes/hydration-on-open).
 */
export function useAppStatus() {
  const { mode, pinned, isFullscreen, hydrated } = useAppStatusStore();

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    appModeService
      .getStatus()
      .then((status) => {
        if (!cancelled) useAppStatusStore.getState().applyStatus(status);
      })
      .catch(() => undefined);

    listen<AppStatusPayload>("app:status", (ev) => {
      useAppStatusStore.getState().applyStatus(ev.payload);
    }).then((un) => {
      if (cancelled) un();
      else unlisten = un;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return { mode, pinned, isFullscreen, hydrated };
}

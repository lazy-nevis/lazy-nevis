import { useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { checkForUpdate } from "@/services/updates";
import { trayService } from "@/services/tauri";
import { selectUnseenVersion, useUpdateStore } from "@/stores/updateStore";

export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Background release check (spec: release-update-check/proactive-notice). Runs at
 * startup and every 6 h, fails silently, and mirrors the unseen version to the
 * tray. Call once from `AppShell`.
 */
export function useUpdateWatcher() {
  const unseenVersion = useUpdateStore(selectUnseenVersion);
  const setRelease = useUpdateStore((s) => s.setRelease);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const release = await checkForUpdate(await getVersion());
        if (!cancelled) setRelease(release);
      } catch {
        // Offline or rate limited: stay quiet and retry on the next tick.
      }
    };
    void run();
    const id = setInterval(run, UPDATE_CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [setRelease]);

  useEffect(() => {
    trayService.setUpdateNotice(unseenVersion).catch(() => undefined);
  }, [unseenVersion]);
}

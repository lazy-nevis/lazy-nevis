import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { notificationService } from "@/services/tauri";

// ── Permission cache ─────────────────────────────────────────────────────────
// Ask the OS at most once per app lifetime; re-reads the grant on every call so
// a permission granted later in system settings is picked up.
let requestedOnce = false;

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (await isPermissionGranted()) return true;
    if (requestedOnce) return false;
    requestedOnce = true;
    return (await requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/** Test-only: reset the permission-request memo. */
export function resetNotificationPermissionCache(): void {
  requestedOnce = false;
}

// ── Dispatch ─────────────────────────────────────────────────────────────────
// Single frontend entry point for OS notifications. Rust applies the delivery
// policy (spec: notification-feedback/single-dispatch-path).
export const notifyManager = {
  /** Send unconditionally (distraction alerts, break reminders). */
  async notify(title: string, body: string): Promise<void> {
    if (!(await ensureNotificationPermission())) return;
    await notificationService.send(title, body).catch(() => {});
  },

  /**
   * Send only when the main window is hidden or unfocused — used for session
   * lifecycle feedback so in-app actions stay quiet.
   */
  async notifyIfInactive(title: string, body: string): Promise<void> {
    if (!(await ensureNotificationPermission())) return;
    await notificationService.send(title, body, true).catch(() => {});
  },
};

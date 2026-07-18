import { describe, it, expect, vi, beforeEach } from "vitest";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import {
  ensureNotificationPermission,
  notifyManager,
  resetNotificationPermissionCache,
} from "./notifications";
import { notificationService } from "@/services/tauri";

beforeEach(() => {
  vi.clearAllMocks();
  resetNotificationPermissionCache();
  vi.mocked(isPermissionGranted).mockResolvedValue(true);
  vi.mocked(requestPermission).mockResolvedValue("granted");
});

describe("ensureNotificationPermission", () => {
  it("requests OS permission at most once when denied", async () => {
    vi.mocked(isPermissionGranted).mockResolvedValue(false);
    vi.mocked(requestPermission).mockResolvedValue("denied");

    expect(await ensureNotificationPermission()).toBe(false);
    expect(await ensureNotificationPermission()).toBe(false);
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it("picks up a grant made later in system settings", async () => {
    vi.mocked(isPermissionGranted).mockResolvedValueOnce(false);
    vi.mocked(requestPermission).mockResolvedValue("denied");
    expect(await ensureNotificationPermission()).toBe(false);

    vi.mocked(isPermissionGranted).mockResolvedValue(true);
    expect(await ensureNotificationPermission()).toBe(true);
  });
});

describe("notifyManager", () => {
  // Spec scenario: notification-feedback/permission-denied
  it("skips dispatch silently when permission is denied", async () => {
    vi.mocked(isPermissionGranted).mockResolvedValue(false);
    vi.mocked(requestPermission).mockResolvedValue("denied");
    const send = vi.spyOn(notificationService, "send");

    await expect(notifyManager.notify("t", "b")).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it("notify() dispatches without the inactive-only flag", async () => {
    const send = vi.spyOn(notificationService, "send").mockResolvedValue();
    await notifyManager.notify("Title", "Body");
    expect(send).toHaveBeenCalledWith("Title", "Body");
  });

  // Spec scenario: notification-feedback/shortcut-trigger-while-app-inactive
  it("notifyIfInactive() dispatches with the inactive-only flag", async () => {
    const send = vi.spyOn(notificationService, "send").mockResolvedValue();
    await notifyManager.notifyIfInactive("Title", "Body");
    expect(send).toHaveBeenCalledWith("Title", "Body", true);
  });
});

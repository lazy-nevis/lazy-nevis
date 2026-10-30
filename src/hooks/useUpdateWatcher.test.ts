import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as updates from "@/services/updates";
import * as tauriService from "@/services/tauri";
import { resetUpdateStoreForTests, useUpdateStore } from "@/stores/updateStore";
import { useUpdateWatcher } from "./useUpdateWatcher";

const release = { version: "0.10.0-rc.5", url: "https://github.com/lazy-nevis/lazy-nevis/releases/tag/v0.10.0-rc.5" };

describe("useUpdateWatcher", () => {
  beforeEach(() => {
    resetUpdateStoreForTests();
    vi.restoreAllMocks();
    vi.spyOn(tauriService.trayService, "setUpdateNotice").mockResolvedValue();
  });

  it("stores the release and tells the tray", async () => {
    vi.spyOn(updates, "checkForUpdate").mockResolvedValue(release);
    renderHook(() => useUpdateWatcher());
    await waitFor(() => expect(useUpdateStore.getState().release).toEqual(release));
    await waitFor(() =>
      expect(tauriService.trayService.setUpdateNotice).toHaveBeenLastCalledWith("0.10.0-rc.5"),
    );
  });

  it("fails silently when offline", async () => {
    vi.spyOn(updates, "checkForUpdate").mockRejectedValue(new Error("offline"));
    renderHook(() => useUpdateWatcher());
    await waitFor(() => expect(updates.checkForUpdate).toHaveBeenCalled());
    expect(useUpdateStore.getState().release).toBeNull();
  });
});

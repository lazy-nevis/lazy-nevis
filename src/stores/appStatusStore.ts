import { create } from "zustand";
import type { AppMode, AppStatusPayload } from "@/types";

interface AppStatusStore {
  mode: AppMode;
  pinned: boolean;
  isFullscreen: boolean;
  hydrated: boolean;
  applyStatus: (status: AppStatusPayload) => void;
}

/** Mirror of the Rust AppStatusManager snapshot (spec: app-modes). */
export const useAppStatusStore = create<AppStatusStore>((set) => ({
  mode: "full",
  pinned: false,
  isFullscreen: false,
  hydrated: false,

  applyStatus: (status) =>
    set({
      mode: status.mode,
      pinned: status.pinned,
      isFullscreen: status.is_fullscreen,
      hydrated: true,
    }),
}));

import { create } from "zustand";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface UiStore {
  toasts: Toast[];
  activeTab: string;
  isStartModalOpen: boolean;
  isFullscreenAlert: boolean;
  fullscreenAlertApp: string;
  fullscreenAlertMs: number;
  isCloseWarningOpen: boolean;
  updateAvailable: string | null;
  addToast: (message: string, type?: Toast["type"]) => void;
  removeToast: (id: string) => void;
  setActiveTab: (tab: string) => void;
  setStartModalOpen: (open: boolean) => void;
  showFullscreenAlert: (app: string, ms: number) => void;
  hideFullscreenAlert: () => void;
  setCloseWarningOpen: (open: boolean) => void;
  setUpdateAvailable: (version: string | null) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  toasts: [],
  activeTab: "/",
  isStartModalOpen: false,
  isFullscreenAlert: false,
  fullscreenAlertApp: "",
  fullscreenAlertMs: 0,
  isCloseWarningOpen: false,
  updateAvailable: null,

  addToast: (message, type = "success") => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  setActiveTab: (tab) => set({ activeTab: tab }),
  setStartModalOpen: (open) => set({ isStartModalOpen: open }),
  showFullscreenAlert: (app, ms) =>
    set({ isFullscreenAlert: true, fullscreenAlertApp: app, fullscreenAlertMs: ms }),
  hideFullscreenAlert: () =>
    set({ isFullscreenAlert: false, fullscreenAlertApp: "", fullscreenAlertMs: 0 }),
  setCloseWarningOpen: (open) => set({ isCloseWarningOpen: open }),
  setUpdateAvailable: (updateAvailable) => set({ updateAvailable }),
}));

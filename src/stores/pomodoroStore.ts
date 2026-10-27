import { create } from "zustand";
import type { PomodoroState } from "@/types";
import { pomodoroService } from "@/services/tauri";

interface PomodoroStore {
  state: PomodoroState | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setState: (state: PomodoroState) => void;
}

export const usePomodoroStore = create<PomodoroStore>((set) => ({
  state: null,
  hydrated: false,
  hydrate: async () => {
    const state = await pomodoroService.getState();
    set({ state, hydrated: true });
  },
  setState: (state) => set({ state }),
}));

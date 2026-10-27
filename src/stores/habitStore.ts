import { create } from "zustand";
import type { Habit, HabitTodaySummary } from "@/types";

interface HabitStoreState {
  today: HabitTodaySummary | null;
  all: Habit[];
  setToday: (summary: HabitTodaySummary | null) => void;
  setAll: (habits: Habit[]) => void;
}

export const useHabitStore = create<HabitStoreState>((set) => ({
  today: null,
  all: [],
  setToday: (today) => set({ today }),
  setAll: (all) => set({ all }),
}));

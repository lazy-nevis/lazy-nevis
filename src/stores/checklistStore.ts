import { create } from "zustand";
import type { ChecklistItem, ChecklistSortMode, Tag } from "@/types";
import { endOfLocalDay, startOfLocalDay } from "@/utils/dates";

export interface ChecklistHistoryFilter {
  from: number | null;
  to: number | null;
  sort: ChecklistSortMode;
  tags: string[];
}

interface ChecklistStore {
  /** Open items plus recently-completed ones still inside the grace window. */
  openItems: ChecklistItem[];
  historyItems: ChecklistItem[];
  allTags: Tag[];
  /** Date resets to today at store creation (spec: daily-checklist/sort-persistence). */
  historyFilter: ChecklistHistoryFilter;
  setOpenItems: (items: ChecklistItem[]) => void;
  setHistoryItems: (items: ChecklistItem[]) => void;
  setAllTags: (tags: Tag[]) => void;
  setHistoryFilter: (patch: Partial<ChecklistHistoryFilter>) => void;
}

export const useChecklistStore = create<ChecklistStore>((set) => ({
  openItems: [],
  historyItems: [],
  allTags: [],
  historyFilter: {
    from: startOfLocalDay(Date.now()),
    to: endOfLocalDay(Date.now()),
    sort: "created",
    tags: [],
  },

  setOpenItems: (openItems) => set({ openItems }),
  setHistoryItems: (historyItems) => set({ historyItems }),
  setAllTags: (allTags) => set({ allTags }),
  setHistoryFilter: (patch) =>
    set((state) => ({ historyFilter: { ...state.historyFilter, ...patch } })),
}));

import { create } from "zustand";
import type { ChecklistItem, ChecklistSortMode, Tag } from "@/types";
import { endOfLocalDay, startOfLocalDay } from "@/utils/dates";
import { isTodayFilter } from "@/hooks/useNow";

export interface ChecklistHistoryFilter {
  from: number | null;
  to: number | null;
  sort: ChecklistSortMode;
  tags: string[];
  categories: string[];
}

interface ChecklistStore {
  /** Open items plus recently-completed ones still inside the grace window. */
  openItems: ChecklistItem[];
  historyItems: ChecklistItem[];
  allTags: Tag[];
  historyFilter: ChecklistHistoryFilter;
  setOpenItems: (items: ChecklistItem[]) => void;
  setHistoryItems: (items: ChecklistItem[]) => void;
  setAllTags: (tags: Tag[]) => void;
  setHistoryFilter: (patch: Partial<ChecklistHistoryFilter>) => void;
}

export function rollHistoryFilterToToday(
  filter: ChecklistHistoryFilter,
  now: number,
): Partial<ChecklistHistoryFilter> | null {
  const yesterday = now - 86400000;
  if (!isTodayFilter(filter.from, filter.to, yesterday)) {
    return null;
  }
  const from = startOfLocalDay(now);
  const to = endOfLocalDay(now);
  if (filter.from === from && filter.to === to) return null;
  return { from, to };
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
    categories: [],
  },

  setOpenItems: (openItems) => set({ openItems }),
  setHistoryItems: (historyItems) => set({ historyItems }),
  setAllTags: (allTags) => set({ allTags }),
  setHistoryFilter: (patch) =>
    set((state) => ({ historyFilter: { ...state.historyFilter, ...patch } })),
}));

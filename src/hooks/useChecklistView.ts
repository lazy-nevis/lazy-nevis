import { useCallback } from "react";
import { useChecklistCategories } from "@/components/features/checklist/CategoryPicker";
import { useSettings } from "@/hooks/useSettings";
import type { ChecklistCategory, ChecklistGroupBy } from "@/types";

/** Sentinel category id meaning "items without a category". */
export const NO_CATEGORY_ID = "__none__";

export interface ChecklistView {
  groupBy: ChecklistGroupBy[];
  categoryFilterIds: string[];
  categories: ChecklistCategory[];
  setGroupBy: (next: ChecklistGroupBy[]) => void;
  setCategoryFilter: (ids: string[]) => void;
}

/** Group-by and category filter for the open checklist, persisted in settings and shared by every window/mode. */
export function useChecklistView(): ChecklistView {
  const { settings, saveSettings } = useSettings();
  const categories = useChecklistCategories();

  const persist = useCallback(
    (patch: Partial<typeof settings.checklist>) => {
      void saveSettings({ ...settings, checklist: { ...settings.checklist, ...patch } }, { silent: true });
    },
    [settings, saveSettings],
  );

  return {
    groupBy: settings.checklist.group_by ?? [],
    categoryFilterIds: settings.checklist.category_filter ?? [],
    categories,
    setGroupBy: (next) => persist({ group_by: next }),
    setCategoryFilter: (ids) => persist({ category_filter: ids }),
  };
}

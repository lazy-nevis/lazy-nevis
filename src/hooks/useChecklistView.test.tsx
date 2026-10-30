import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useChecklistView } from "./useChecklistView";
import { useSettingsStore } from "@/stores/settingsStore";

const saveSettings = vi.fn();
const base = useSettingsStore.getState().settings;
const settings = {
  ...base,
  checklist: { ...base.checklist, group_by: ["category" as const], category_filter: ["c1"] },
};

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({ settings, saveSettings }),
}));
vi.mock("@/components/features/checklist/CategoryPicker", () => ({
  useChecklistCategories: () => [],
}));

describe("useChecklistView", () => {
  it("reads group-by and filter from settings", () => {
    const { result } = renderHook(() => useChecklistView());
    expect(result.current.groupBy).toEqual(["category"]);
    expect(result.current.categoryFilterIds).toEqual(["c1"]);
  });

  it("persists changes silently through settings", () => {
    const { result } = renderHook(() => useChecklistView());
    result.current.setGroupBy(["date", "category"]);
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ checklist: expect.objectContaining({ group_by: ["date", "category"] }) }),
      { silent: true },
    );
    result.current.setCategoryFilter([]);
    expect(saveSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ checklist: expect.objectContaining({ category_filter: [] }) }),
      { silent: true },
    );
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/i18n";
import { ChecklistHistory } from "./ChecklistHistory";
import { checklistService } from "@/services/tauri";
import { useChecklistStore } from "@/stores/checklistStore";

beforeEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage("en-US");
  useChecklistStore.setState({
    historyItems: [],
    allTags: [],
    historyFilter: {
      from: null,
      to: null,
      sort: "created",
      tags: [],
      categories: [],
    },
  });
  vi.spyOn(checklistService, "listHistory").mockResolvedValue([]);
  vi.spyOn(checklistService, "listTags").mockResolvedValue([]);
  vi.spyOn(checklistService, "listCategories").mockResolvedValue([
    { id: "c1", name: "Work", tone: "sky", sort_order: 1, created_at: 0 },
  ]);
});

describe("ChecklistHistory", () => {
  it("filters history by category chip", async () => {
    render(<ChecklistHistory onSortPersist={vi.fn()} onRestore={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Work")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Work"));
    expect(useChecklistStore.getState().historyFilter.categories).toEqual(["c1"]);
    await waitFor(() =>
      expect(checklistService.listHistory).toHaveBeenCalledWith(
        null,
        null,
        "created",
        [],
        ["c1"],
      ),
    );
  });
});

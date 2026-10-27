import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/i18n";
import { ChecklistItemRow } from "./ChecklistItemRow";
import { checklistService } from "@/services/tauri";
import type { ChecklistItem } from "@/types";

const row: ChecklistItem = {
  id: "1",
  title: "Task",
  created_at: Date.now(),
  completed_at: null,
  due_date: null,
  due_has_time: false,
  sort_order: 1,
  parent_id: null,
  category: { id: "c1", name: "Work", tone: "sky", sort_order: 1, created_at: 0 },
  priority: "medium",
  tags: [],
};

beforeEach(async () => {
  await i18n.changeLanguage("en-US");
  vi.spyOn(checklistService, "listCategories").mockResolvedValue([row.category!]);
});

describe("ChecklistItemRow", () => {
  it("exposes category and priority controls in full mode", async () => {
    const onUpdate = vi.fn();
    render(
      <ChecklistItemRow
        entry={{ item: row, grace: null }}
        graceMs={10_000}
        onToggleComplete={vi.fn()}
        onUndo={vi.fn()}
        onUpdate={onUpdate}
      />,
    );
    // Category/Priority are custom listbox buttons now (see ui/select.tsx), not
    // native <select>s — open the popover and click an option like a real user.
    fireEvent.click(screen.getByLabelText(/Category/i));
    fireEvent.click(await screen.findByRole("option", { name: "Work" }));

    fireEvent.click(screen.getByLabelText(/Priority/i));
    fireEvent.click(await screen.findByRole("option", { name: "Urgent" }));

    expect(onUpdate).toHaveBeenCalled();
  });
});

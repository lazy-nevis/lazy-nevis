import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/i18n";
import { ChecklistGroupedList } from "./ChecklistGroupedList";
import type { ChecklistItem } from "@/types";

describe("checklist cascade UI", () => {
  it("completing parent invokes complete handler for parent row", async () => {
    await i18n.changeLanguage("en-US");
    const parent: ChecklistItem = {
      id: "p",
      title: "Parent",
      created_at: 0,
      completed_at: null,
      due_date: null,
      due_has_time: false,
      sort_order: 1,
      parent_id: null,
      category: null,
      priority: "none",
      tags: [],
    };
    const sub: ChecklistItem = {
      id: "s",
      title: "Sub",
      created_at: 0,
      completed_at: null,
      due_date: null,
      due_has_time: false,
      sort_order: 2,
      parent_id: "p",
      category: null,
      priority: "none",
      tags: [],
    };
    const onToggleComplete = vi.fn();
    render(
      <ChecklistGroupedList
        openView={[
          { item: parent, grace: null },
          { item: sub, grace: null },
        ]}
        groupBy={[]}
        graceMs={10_000}
        categoryFilterIds={[]}
        createItem={vi.fn()}
        onToggleComplete={onToggleComplete}
        onUndo={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        previewReorder={vi.fn()}
        commitReorder={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    const parentRow = screen.getByTestId("checklist-row-p");
    fireEvent.click(parentRow.querySelector('button[aria-label="Mark as done"]')!);
    expect(onToggleComplete).toHaveBeenCalledWith(parent);
  });
});

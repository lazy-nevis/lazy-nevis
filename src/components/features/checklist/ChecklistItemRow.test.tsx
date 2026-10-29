import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function renderRow(onUpdate = vi.fn(), compact = false) {
  render(
    <ChecklistItemRow
      entry={{ item: row, grace: null }}
      graceMs={10_000}
      compact={compact}
      onToggleComplete={vi.fn()}
      onUndo={vi.fn()}
      onUpdate={onUpdate}
    />,
  );
  return onUpdate;
}

beforeEach(async () => {
  await i18n.changeLanguage("en-US");
  vi.spyOn(checklistService, "listCategories").mockResolvedValue([row.category!]);
});

describe("ChecklistItemRow", () => {
  it("renders flat: no entry card until the title is clicked", () => {
    renderRow();
    expect(screen.queryByTestId("checklist-entry-card")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Category/i)).not.toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
  });

  it("edits through the card and the + menu with a highlighted selection", async () => {
    const onUpdate = renderRow();
    fireEvent.click(screen.getByText("Task"));
    expect(screen.getByTestId("checklist-entry-card")).toBeInTheDocument();

    // Priority picker is a floating dialog and marks the current level.
    fireEvent.click(screen.getByLabelText("More options"));
    const menu = await screen.findByRole("dialog");
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Priority/i }));
    expect(await screen.findByRole("option", { name: /Medium/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("option", { name: /Urgent/ }));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "1" }),
        expect.objectContaining({ title: "Task", priority: "urgent", category: "Work" }),
      ),
    );
  });

  it("keeps date-like text already in the title when saving an edit", async () => {
    const onUpdate = vi.fn();
    render(
      <ChecklistItemRow
        entry={{ item: { ...row, title: "Ship até 03/11" }, grace: null }}
        graceMs={10_000}
        onToggleComplete={vi.fn()}
        onUndo={vi.fn()}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByText("Ship até 03/11"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ title: "Ship até 03/11", dueDate: null }),
      ),
    );
  });

  it("uses icon-only footer buttons in compact mode", () => {
    renderRow(vi.fn(), true);
    fireEvent.click(screen.getByText("Task"));
    expect(screen.getByRole("button", { name: "Save" }).textContent).toBe("");
  });

  it("opens quick items on right-click and applies a priority change", async () => {
    const onUpdate = renderRow(vi.fn(), true);
    fireEvent.contextMenu(screen.getByTestId("checklist-row-1"));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Priority/ }));
    fireEvent.click(await screen.findByRole("option", { name: /High/i }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(row, { priority: "high" }));
  });

  it("always shows the category on its own meta line in compact mode", () => {
    renderRow(vi.fn(), true);
    expect(screen.getByText("Work")).toBeInTheDocument();
  });
});

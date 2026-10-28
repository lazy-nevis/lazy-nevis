import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "@/i18n";
import { ChecklistGroupedList } from "./ChecklistGroupedList";
import type { ChecklistItem } from "@/types";
import type { OpenChecklistEntry } from "@/hooks/useChecklist";

function item(id: string, overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id,
    title: id,
    created_at: 0,
    completed_at: null,
    due_date: null,
    due_has_time: false,
    sort_order: 1,
    parent_id: null,
    category: null,
    priority: "none",
    tags: [],
    ...overrides,
  };
}

function entry(row: ChecklistItem): OpenChecklistEntry {
  return { item: row, grace: null };
}

beforeEach(async () => {
  await i18n.changeLanguage("en-US");
});

describe("ChecklistGroupedList", () => {
  it("renders compact grouped headers from settings dimensions", () => {
    const now = Date.parse("2026-10-26T12:00:00");
    vi.setSystemTime(now);
    const openView = [
      entry(item("a", { due_date: null })),
      entry(item("b", { due_date: now })),
    ];
    render(
      <ChecklistGroupedList
        openView={openView}
        groupBy={["date"]}
        graceMs={10_000}
        compact
        categoryFilterIds={[]}
        createItem={vi.fn()}
        onToggleComplete={vi.fn()}
        onUndo={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        previewReorder={vi.fn()}
        commitReorder={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByText(/No date/i)).toBeInTheDocument();
    expect(screen.getByText(/Today/i)).toBeInTheDocument();
  });
});

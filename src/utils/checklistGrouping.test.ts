import { describe, expect, it } from "vitest";
import { groupItems, reorderFlatList, sortOrdersFromFlatOrder } from "./checklistGrouping";
import type { ChecklistItem } from "@/types";

const base = (overrides: Partial<ChecklistItem>): ChecklistItem => ({
  id: overrides.id ?? "1",
  title: overrides.title ?? "T",
  created_at: 0,
  completed_at: null,
  due_date: null,
  due_has_time: false,
  sort_order: overrides.sort_order ?? 1,
  parent_id: null,
  category: null,
  priority: "none",
  tags: [],
  ...overrides,
});

describe("groupItems", () => {
  const now = Date.parse("2026-10-26T12:00:00");

  it("orders date groups as no date, overdue, today, tomorrow, then due days", () => {
    const items = [
      base({ id: "a", due_date: null, sort_order: 1 }),
      base({ id: "b", due_date: now - 86400000, sort_order: 2 }),
      base({ id: "c", due_date: now, sort_order: 3 }),
      base({ id: "d", due_date: now + 86400000, sort_order: 4 }),
      base({ id: "e", due_date: now + 5 * 86400000, sort_order: 5 }),
    ];
    const groups = groupItems(items, ["date"], { now });
    expect(groups.map((g) => g.labelKey)).toEqual([
      "checklist.groups.no_date",
      "checklist.groups.overdue",
      "checklist.groups.today",
      "checklist.groups.tomorrow",
      "checklist.groups.due_on",
    ]);
  });
});

describe("reorderFlatList", () => {
  const now = Date.parse("2026-10-26T12:00:00");

  it("reorders only within the same date group", () => {
    const a = base({ id: "a", due_date: null, sort_order: 1 });
    const b = base({ id: "b", due_date: now, sort_order: 2 });
    const c = base({ id: "c", due_date: null, sort_order: 3 });
    const flat = ["a", "b", "c"];
    expect(reorderFlatList(flat, [a, b, c], "a", "b", ["date"], now)).toBeNull();
    const next = reorderFlatList(flat, [a, b, c], "a", "c", ["date"], now);
    expect(next).toEqual(["b", "c", "a"]);
  });

  it("assigns unique contiguous sort orders after reorder", () => {
    const flat = ["c", "a", "b"];
    const orders = sortOrdersFromFlatOrder(flat);
    expect([...orders.values()]).toEqual([1, 2, 3]);
  });

  it("moves parent block with sub-items together", () => {
    const parent = base({ id: "p", sort_order: 1 });
    const sub = base({ id: "s", parent_id: "p", sort_order: 2 });
    const other = base({ id: "o", sort_order: 3 });
    const flat = ["p", "s", "o"];
    const next = reorderFlatList(flat, [parent, sub, other], "o", "p", [], now);
    expect(next).toEqual(["o", "p", "s"]);
  });

  it("gives every nested group a unique, path-qualified key", () => {
    const items = [
      base({ id: "a", priority: "none", category: { id: "c1", name: "A", tone: "sky", sort_order: 1, created_at: 0 } }),
      base({ id: "b", priority: "none", category: { id: "c2", name: "B", tone: "sky", sort_order: 2, created_at: 0 } }),
      base({ id: "c", priority: "high", category: { id: "c2", name: "B", tone: "sky", sort_order: 2, created_at: 0 } }),
    ];
    const groups = groupItems(items, ["category", "priority"], { now: Date.now() });
    const keys: string[] = [];
    const walk = (nodes: typeof groups) =>
      nodes.forEach((node) => {
        keys.push(node.key);
        walk(node.children);
      });
    walk(groups);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

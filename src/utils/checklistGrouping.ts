import type { ChecklistGroupBy, ChecklistItem, ChecklistPriority } from "@/types";
import { endOfLocalDay, startOfLocalDay } from "@/utils/dates";

export interface GroupNode {
  key: string;
  labelKey: string;
  labelParams?: Record<string, string | number>;
  tone?: string;
  children: GroupNode[];
  items: ChecklistItem[];
}

export interface TreeItem {
  item: ChecklistItem;
  children: ChecklistItem[];
}

export function buildTree(items: ChecklistItem[]): TreeItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const childrenByParent = new Map<string, ChecklistItem[]>();
  const roots: ChecklistItem[] = [];

  for (const item of items) {
    if (item.parent_id && byId.has(item.parent_id)) {
      const list = childrenByParent.get(item.parent_id) ?? [];
      list.push(item);
      childrenByParent.set(item.parent_id, list);
    } else if (!item.parent_id) {
      roots.push(item);
    }
  }

  roots.sort((a, b) => a.sort_order - b.sort_order);
  return roots.map((item) => ({
    item,
    children: (childrenByParent.get(item.id) ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }));
}

function dateBucket(item: ChecklistItem, now: number): string {
  if (item.due_date === null) return "no_date";
  const todayStart = startOfLocalDay(now);
  const todayEnd = endOfLocalDay(now);
  const tomorrowEnd = endOfLocalDay(now + 86400000);
  if (item.due_date < todayStart) return "overdue";
  if (item.due_date <= todayEnd) return "today";
  if (item.due_date <= tomorrowEnd) return "tomorrow";
  return `due_${startOfLocalDay(item.due_date)}`;
}

const PRIORITY_ORDER: ChecklistPriority[] = ["urgent", "high", "medium", "low", "none"];

function priorityBucket(priority: ChecklistPriority): string {
  return priority;
}

function nestGroups(
  trees: TreeItem[],
  dimensions: ChecklistGroupBy[],
  depth: number,
  now: number,
  parentKey = "",
): GroupNode[] {
  if (depth >= dimensions.length) {
    return [
      {
        key: "flat",
        labelKey: "",
        children: [],
        items: trees.map((tree) => tree.item),
      },
    ];
  }

  const dimension = dimensions[depth];
  const buckets = new Map<string, TreeItem[]>();

  for (const tree of trees) {
    let key = "none";
    if (dimension === "category") {
      key = tree.item.category?.id ?? "none";
    } else if (dimension === "date") {
      key = dateBucket(tree.item, now);
    } else {
      key = priorityBucket(tree.item.priority);
    }
    const list = buckets.get(key) ?? [];
    list.push(tree);
    buckets.set(key, list);
  }

  const orderedKeys = [...buckets.keys()].sort((a, b) => {
    if (dimension === "date") {
      const order = ["no_date", "overdue", "today", "tomorrow"];
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      if (a.startsWith("due_") && b.startsWith("due_")) {
        return Number(a.slice(4)) - Number(b.slice(4));
      }
    }
    if (dimension === "priority") {
      return PRIORITY_ORDER.indexOf(a as ChecklistPriority) - PRIORITY_ORDER.indexOf(b as ChecklistPriority);
    }
    if (a === "none") return 1;
    if (b === "none") return -1;
    return a.localeCompare(b);
  });

  return orderedKeys.map((key) => {
    const groupTrees = buckets.get(key) ?? [];
    const sample = groupTrees[0]?.item;
    let labelKey = "checklist.groups.flat";
    let labelParams: Record<string, string | number> | undefined;
    let tone: string | undefined;

    if (dimension === "category") {
      if (key === "none") labelKey = "checklist.groups.no_category";
      else {
        labelKey = "checklist.groups.category";
        labelParams = { name: sample?.category?.name ?? "" };
        tone = sample?.category?.tone;
      }
    } else if (dimension === "date") {
      if (key === "no_date") labelKey = "checklist.groups.no_date";
      else if (key === "overdue") labelKey = "checklist.groups.overdue";
      else if (key === "today") labelKey = "checklist.groups.today";
      else if (key === "tomorrow") labelKey = "checklist.groups.tomorrow";
      else {
        labelKey = "checklist.groups.due_on";
        labelParams = { date: Number(key.slice(4)) };
      }
    } else if (dimension === "priority") {
      labelKey = `checklist.priority.${key}`;
    }

    // Path-qualified: "no priority" under two categories must not share a React key or collapse state.
    const nodeKey = `${parentKey}/${dimension}:${key}`;
    const childNodes = nestGroups(groupTrees, dimensions, depth + 1, now, nodeKey);
    const items = childNodes.flatMap((node) => node.items);
    return {
      key: nodeKey,
      labelKey,
      labelParams,
      tone,
      children: childNodes.filter((node) => node.labelKey),
      items,
    };
  });
}

export function groupItems(
  items: ChecklistItem[],
  groupBy: ChecklistGroupBy[],
  options: { now: number },
): GroupNode[] {
  const trees = buildTree(items);
  if (groupBy.length === 0) {
    return [
      {
        key: "flat",
        labelKey: "",
        children: [],
        items: trees.map((tree) => tree.item),
      },
    ];
  }
  return nestGroups(trees, groupBy, 0, options.now);
}

export function flattenGroupItemIds(nodes: GroupNode[]): string[] {
  const ids: string[] = [];
  const walk = (node: GroupNode) => {
    for (const item of node.items) ids.push(item.id);
    for (const child of node.children) walk(child);
  };
  for (const node of nodes) walk(node);
  return ids;
}

export function moveWithinGroup(
  order: string[],
  draggedId: string,
  overId: string,
  sameGroup: (id: string) => boolean,
): string[] | null {
  if (!sameGroup(draggedId) || !sameGroup(overId)) return null;
  const next = [...order];
  const from = next.indexOf(draggedId);
  const to = next.indexOf(overId);
  if (from < 0 || to < 0) return null;
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/** Innermost reorder bucket: siblings share parent; top-level items share group-by dimensions. */
export function innerGroupKey(
  item: ChecklistItem,
  groupBy: ChecklistGroupBy[],
  now: number,
): string {
  if (item.parent_id) {
    return `siblings:${item.parent_id}`;
  }
  if (groupBy.length === 0) return "flat";
  const parts = groupBy.map((dimension) => {
    if (dimension === "category") return item.category?.id ?? "none";
    if (dimension === "date") return dateBucket(item, now);
    return priorityBucket(item.priority);
  });
  return parts.join("|");
}

/** Parent row drags with its sub-items (spec: checklist-organization). */
export function dragBlockIds(
  flatIds: string[],
  itemsById: Map<string, ChecklistItem>,
  anchorId: string,
): string[] {
  const anchor = itemsById.get(anchorId);
  if (!anchor) return [anchorId];
  const rootId = anchor.parent_id ?? anchor.id;
  if (anchor.parent_id) return [anchorId];
  const block = [rootId];
  for (const id of flatIds) {
    const row = itemsById.get(id);
    if (row?.parent_id === rootId) block.push(id);
  }
  return block;
}

/**
 * Reorders the flat open list within the same innermost group; returns null when the drop
 * target is in another group (ignored).
 */
export function reorderFlatList(
  flatIds: string[],
  items: ChecklistItem[],
  draggedId: string,
  overId: string,
  groupBy: ChecklistGroupBy[],
  now: number,
): string[] | null {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const dragged = itemsById.get(draggedId);
  const over = itemsById.get(overId);
  if (!dragged || !over) return null;
  if (innerGroupKey(dragged, groupBy, now) !== innerGroupKey(over, groupBy, now)) {
    return null;
  }

  const dragBlock = dragBlockIds(flatIds, itemsById, draggedId);
  const overBlock = dragBlockIds(flatIds, itemsById, overId);
  if (dragBlock.some((id) => overBlock.includes(id))) return null;

  const fromIndex = flatIds.indexOf(dragBlock[0]);
  const toIndex = flatIds.indexOf(overBlock[0]);
  if (fromIndex < 0 || toIndex < 0) return null;

  const without = flatIds.filter((id) => !dragBlock.includes(id));
  let insertAt = without.indexOf(overBlock[0]);
  if (insertAt < 0) return null;
  if (fromIndex < toIndex) insertAt += 1;

  const next = [...without];
  next.splice(insertAt, 0, ...dragBlock);
  return next;
}

/** Assigns contiguous sort_order values (1..n) following flat id order. */
export function sortOrdersFromFlatOrder(flatIds: string[]): Map<string, number> {
  const order = new Map<string, number>();
  flatIds.forEach((id, index) => {
    order.set(id, index + 1);
  });
  return order;
}

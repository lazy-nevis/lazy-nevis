import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { celebrate } from "@/components/ui/motion";
import { ChecklistInput } from "./ChecklistInput";
import { ChecklistItemRow } from "./ChecklistItemRow";
import type { OpenChecklistEntry } from "@/hooks/useChecklist";
import type { ChecklistGroupBy, ChecklistItem } from "@/types";
import { buildTree, groupItems, reorderFlatList, type GroupNode } from "@/utils/checklistGrouping";
import { useNow } from "@/hooks/useNow";
import { formatDate } from "@/utils/formatters";
import { cn } from "@/utils/cn";

interface Props {
  openView: OpenChecklistEntry[];
  groupBy: ChecklistGroupBy[];
  graceMs: number;
  compact?: boolean;
  categoryFilterIds: string[];
  createItem: (input: import("@/types").CreateChecklistInput) => Promise<unknown>;
  onToggleComplete: (item: ChecklistItem) => void;
  onUndo: (item: ChecklistItem) => void;
  onUpdate: (item: ChecklistItem, patch: import("@/types").UpdateChecklistPatch) => void;
  onDelete: (item: ChecklistItem) => void;
  onStartFocus?: (item: ChecklistItem, parent?: ChecklistItem) => void;
  onTagClick?: (name: string) => void;
  previewReorder: (ids: string[]) => void;
  commitReorder: () => Promise<void>;
}

export function ChecklistGroupedList({
  openView,
  groupBy,
  graceMs,
  compact = false,
  categoryFilterIds,
  createItem,
  onToggleComplete,
  onUndo,
  onUpdate,
  onDelete,
  onStartFocus,
  onTagClick,
  previewReorder,
  commitReorder,
}: Props) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const dragId = useRef<string | null>(null);
  const rowEls = useRef(new Map<string, HTMLElement>());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});

  const items = useMemo(
    () =>
      openView
        .map((entry) => entry.item)
        .filter((item) => {
          if (categoryFilterIds.length === 0) return true;
          if (!item.category) return categoryFilterIds.includes("__none__");
          return categoryFilterIds.includes(item.category.id);
        }),
    [openView, categoryFilterIds],
  );

  const entryById = useMemo(
    () => new Map(openView.map((entry) => [entry.item.id, entry])),
    [openView],
  );

  const groups = useMemo(
    () => groupItems(items, groupBy, { now }),
    [items, groupBy, now],
  );

  const trees = useMemo(() => buildTree(items), [items]);

  /** Completing the last open item of a category fires a small confetti pop from its row. */
  const handleToggleComplete = (item: ChecklistItem) => {
    const categoryId = item.category?.id;
    if (categoryId && !entryById.get(item.id)?.grace) {
      const othersOpen = items.some(
        (other) =>
          other.id !== item.id &&
          other.category?.id === categoryId &&
          other.completed_at === null &&
          !entryById.get(other.id)?.grace,
      );
      if (!othersOpen) celebrate(rowEls.current.get(item.id), "small");
    }
    onToggleComplete(item);
  };

  const handleDragOver = (overId: string) => {
    const dragging = dragId.current;
    if (!dragging || dragging === overId) return;
    const flatIds = openView.map((entry) => entry.item.id);
    const allItems = openView.map((entry) => entry.item);
    const next = reorderFlatList(flatIds, allItems, dragging, overId, groupBy, now);
    if (next) previewReorder(next);
  };

  const handleDragEnd = () => {
    if (!dragId.current) return;
    dragId.current = null;
    void commitReorder();
  };

  const renderGroupHeader = (node: GroupNode) => {
    if (!node.labelKey) return null;
    const collapsedNow = collapsed[node.key];
    let label = t(node.labelKey, node.labelParams ?? {});
    if (node.labelKey === "checklist.groups.due_on" && node.labelParams?.date) {
      label = t(node.labelKey, { date: formatDate(Number(node.labelParams.date), i18n.language) });
    }
    return (
      <button
        type="button"
        key={node.key}
        onClick={() => setCollapsed((state) => ({ ...state, [node.key]: !collapsedNow }))}
        className={cn(
          "mb-1 flex w-full items-center gap-2 text-left text-xs font-medium text-muted-foreground",
          compact && "text-[10px]",
        )}
      >
        <span aria-hidden>{collapsedNow ? "▸" : "▾"}</span>
        {label}
        <span className="text-muted-foreground/70">({node.items.length})</span>
      </button>
    );
  };

  const renderItem = (item: ChecklistItem, parent?: ChecklistItem) => {
    const entry = entryById.get(item.id);
    if (!entry) return null;
    const tree = trees.find((node) => node.item.id === item.id);
    const children = tree?.children ?? [];
    const defaultExpanded = compact ? false : true;
    const expanded = expandedSubs[item.id] ?? defaultExpanded;
    const doneSubs = children.filter((child) => {
      const childEntry = entryById.get(child.id);
      return childEntry?.grace !== null || child.completed_at !== null;
    }).length;

    return (
      <motion.div
        key={item.id}
        layout="position"
        transition={{ type: "spring", bounce: 0.1, visualDuration: 0.3 }}
        className="space-y-1"
        ref={(el: HTMLDivElement | null) => {
          if (el) rowEls.current.set(item.id, el);
          else rowEls.current.delete(item.id);
        }}
      >
        <ChecklistItemRow
          entry={entry}
          graceMs={graceMs}
          compact={compact}
          draggable
          onToggleComplete={handleToggleComplete}
          onUndo={onUndo}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onStartFocus={onStartFocus ? () => onStartFocus(item, parent) : undefined}
          onTagClick={onTagClick}
          onDragStart={(id) => {
            dragId.current = id;
          }}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        />
        {children.length > 0 && (
          <>
            <button
              type="button"
              className="ml-8 text-[11px] text-muted-foreground"
              aria-expanded={expanded}
              onClick={() => setExpandedSubs((state) => ({ ...state, [item.id]: !expanded }))}
            >
              {expanded ? "▾" : "▸"} {t("checklist.subitem_progress", { done: doneSubs, total: children.length })}
            </button>
            {expanded && children.map((child) => renderItem(child, item))}
            {expanded && (
              <ChecklistInput onCreate={createItem} parentId={item.id} compact={compact} />
            )}
          </>
        )}
      </motion.div>
    );
  };

  const walk = (nodes: GroupNode[]): ReactNode[] => {
    const output: ReactNode[] = [];
    for (const node of nodes) {
      if (node.labelKey) {
        output.push(renderGroupHeader(node));
        if (collapsed[node.key]) continue;
      }
      if (node.children.length > 0) {
        output.push(...walk(node.children));
      } else {
        for (const item of node.items) {
          if (!item.parent_id) output.push(renderItem(item));
        }
      }
    }
    return output;
  };

  return <div className="space-y-1.5">{walk(groups)}</div>;
}

import { useState } from "react";
import type { DragEvent } from "react";
import { Calendar, Check, GripVertical, Pencil, Play, Tag as TagIcon, Trash2, Undo2 } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { TagChip } from "./TagChip";
import type { OpenChecklistEntry } from "@/hooks/useChecklist";
import type { ChecklistItem, UpdateChecklistPatch } from "@/types";
import { daysAgo, startOfLocalDay } from "@/utils/dates";
import { useNow } from "@/hooks/useNow";
import { PRIORITY_RING_CLASS } from "./PriorityFlag";
import { ChecklistEntryCard, type EntryValues } from "./ChecklistEntryCard";
import { toTone, toneStyle } from "@/utils/tones";
import { formatDate, formatDateTime } from "@/utils/formatters";
import { cn } from "@/utils/cn";

export interface ChecklistItemRowProps {
  entry: OpenChecklistEntry;
  graceMs: number;
  /** Compact rendering for small surfaces (tray popover / compact mode). */
  compact?: boolean;
  draggable?: boolean;
  onToggleComplete: (item: ChecklistItem) => void;
  onUndo: (item: ChecklistItem) => void;
  onUpdate?: (item: ChecklistItem, patch: UpdateChecklistPatch) => void;
  onDelete?: (item: ChecklistItem) => void;
  onStartFocus?: (item: ChecklistItem) => void;
  onTagClick?: (name: string) => void;
  onDragStart?: (id: string) => void;
  onDragOver?: (id: string) => void;
  onDragEnd?: () => void;
}

/** Native tooltip: full title plus tags (spec: tray-quick-panel/full-item-tooltip). */
export function itemTooltip(item: ChecklistItem): string {
  const tags = item.tags.map((tag) => `#${tag.name}`).join(" ");
  return tags ? `${item.title}\n${tags}` : item.title;
}

export function ChecklistItemRow({
  entry,
  graceMs,
  compact = false,
  draggable = false,
  onToggleComplete,
  onUndo,
  onUpdate,
  onDelete,
  onStartFocus,
  onTagClick,
  onDragStart,
  onDragOver,
  onDragEnd,
}: ChecklistItemRowProps) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const { item, grace } = entry;
  const isSubItem = item.parent_id !== null;
  const [editing, setEditing] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  const age = daysAgo(item.created_at, now);
  const overdue =
    item.completed_at === null && item.due_date !== null && item.due_date < startOfLocalDay(now);

  const graceProgress = grace ? Math.max(0, Math.min(1, grace.remainingMs / graceMs)) : 0;
  const graceSeconds = grace ? Math.max(0, Math.ceil(grace.remainingMs / 1000)) : 0;

  if (editing && onUpdate && !grace) {
    const initial: EntryValues = {
      title: item.title,
      tags: item.tags.map((tag) => tag.name),
      category: item.category?.name ?? null,
      priority: item.priority,
      dueDate: item.due_date,
      dueHasTime: item.due_has_time,
    };
    return (
      <div
        className={cn("border-b border-border/40 py-1.5", isSubItem && "ml-6")}
        data-testid={`checklist-row-${item.id}`}
      >
        <ChecklistEntryCard
          mode="edit"
          initial={initial}
          compact={compact}
          allowCategory={!isSubItem}
          onCancel={() => setEditing(false)}
          onSubmit={(values) => {
            setEditing(false);
            onUpdate(item, {
              title: values.title,
              tags: values.tags,
              ...(isSubItem ? {} : { category: values.category }),
              priority: values.priority,
              dueDate: values.dueDate,
              dueHasTime: values.dueHasTime,
            });
          }}
        />
      </div>
    );
  }

  const startEditing = () => {
    if (!grace && onUpdate) setEditing(true);
  };

  const dueLabel =
    item.due_date === null
      ? null
      : item.due_has_time
        ? formatDateTime(item.due_date, i18n.language).slice(0, -3)
        : formatDate(item.due_date, i18n.language);
  const showMeta =
    !compact && (dueLabel || item.tags.length > 0 || (item.category && !isSubItem) || age > 0);

  return (
    <div
      draggable={draggable && !grace}
      onDragStart={(e: DragEvent<HTMLDivElement>) => {
        // WebKit only starts an HTML5 drag when data is set on dragstart.
        if (e.dataTransfer) {
          e.dataTransfer.setData("text/plain", item.id);
          e.dataTransfer.effectAllowed = "move";
        }
        onDragStart?.(item.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        onDragOver?.(item.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDragEnd?.();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        // Flat Todoist-style row: no card, just a divider (the entry card only appears while editing).
        "group relative overflow-hidden border-b transition-all duration-300",
        compact ? "border-border/40 px-1 py-1.5 hover:bg-accent/50" : "border-border/60 px-1 py-2.5",
        isSubItem && "ml-6",
        grace?.leaving && "max-h-0 border-transparent py-0 opacity-0",
        !grace?.leaving && "max-h-[500px] opacity-100",
      )}
      data-testid={`checklist-row-${item.id}`}
    >
      <div className="flex items-start gap-2">
        {draggable && (
          <GripVertical
            className={cn(
              "mt-0.5 shrink-0 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100",
              compact ? "h-3.5 w-3.5" : "h-4 w-4",
            )}
          />
        )}

        <motion.button
          type="button"
          initial={false}
          animate={grace ? { scale: [1, 1.2, 1] } : { scale: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onClick={() => (grace ? onUndo(item) : onToggleComplete(item))}
          aria-label={grace ? t("checklist.undo") : t("checklist.complete")}
          className={cn(
            "mt-0.5 flex shrink-0 items-center justify-center rounded-full border-2 transition-colors hover:brightness-110",
            compact ? "h-4 w-4" : "h-5 w-5",
            grace ? "border-green-500 bg-green-500 text-white" : PRIORITY_RING_CLASS[item.priority],
          )}
        >
          {grace && <Check className="h-3 w-3" />}
        </motion.button>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            title={itemTooltip(item)}
            onClick={startEditing}
            className={cn(
              "block w-full whitespace-pre-wrap break-words text-left",
              compact ? "text-xs leading-5" : "text-sm leading-5",
              grace && "text-muted-foreground line-through",
            )}
          >
            {item.title}
          </button>

          {compact && tagsOpen && item.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <TagChip key={tag.id} name={tag.name} onClick={onTagClick} />
              ))}
            </div>
          )}

          {compact && dueLabel && (
            <div
              className={cn(
                "mt-0.5 flex items-center gap-1 text-[11px]",
                overdue ? "text-destructive" : "text-muted-foreground",
              )}
            >
              <Calendar className="h-3 w-3" aria-hidden />
              {dueLabel}
            </div>
          )}

          {showMeta && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {dueLabel && (
                <span className={cn("inline-flex items-center gap-1", overdue && "text-destructive")}>
                  <Calendar className="h-3 w-3" aria-hidden />
                  {dueLabel}
                  {overdue && ` · ${t("checklist.overdue")}`}
                </span>
              )}
              {item.category && !isSubItem && (
                <span className="inline-flex items-center gap-1">
                  <span
                    className="tone-dot h-2 w-2 rounded-full"
                    style={toneStyle(toTone(item.category.tone))}
                    aria-hidden
                  />
                  {item.category.name}
                </span>
              )}
              {item.tags.map((tag) => (
                <TagChip key={tag.id} name={tag.name} onClick={onTagClick} />
              ))}
              {age > 0 && <span>{t("checklist.created_days_ago", { count: age })}</span>}
            </div>
          )}
        </div>

        {grace ? (
          <button
            type="button"
            onClick={() => onUndo(item)}
            className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Undo2 className="h-3.5 w-3.5" />
            {t("checklist.undo")} · {graceSeconds}s
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-0.5">
            {/* Tags disclosure — compact surfaces have no room for inline chips
                (spec: app-modes/compact-tags-popover). Always visible so the
                user knows the item is tagged. */}
            {compact && item.tags.length > 0 && (
              <button
                type="button"
                onClick={() => setTagsOpen((open) => !open)}
                title={t("checklist.show_tags", { count: item.tags.length })}
                aria-label={t("checklist.show_tags", { count: item.tags.length })}
                aria-expanded={tagsOpen}
                className={cn(
                  "flex items-center gap-0.5 rounded p-1 text-[11px] transition-colors hover:bg-accent",
                  tagsOpen ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <TagIcon className="h-3.5 w-3.5" />
                {item.tags.length}
              </button>
            )}
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              {onUpdate && (
                <button
                  type="button"
                  onClick={startEditing}
                  title={t("checklist.entry.edit")}
                  aria-label={t("checklist.entry.edit")}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {onStartFocus && (
                <button
                  type="button"
                  onClick={() => onStartFocus(item)}
                  title={t("checklist.start_focus")}
                  aria-label={t("checklist.start_focus")}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-green-600"
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  title={t("common.delete")}
                  aria-label={t("common.delete")}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Grace countdown bar (spec: daily-checklist/complete-and-wait) */}
      {grace && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-muted">
          <div
            className="h-full bg-green-500 transition-[width] duration-200 ease-linear motion-reduce:transition-none"
            style={{ width: `${graceProgress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

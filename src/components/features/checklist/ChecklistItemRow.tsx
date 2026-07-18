import { useState } from "react";
import type { DragEvent } from "react";
import { Calendar, Check, GripVertical, Play, Tag as TagIcon, Trash2, Undo2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { TagChip } from "./TagChip";
import { parseInlineTags } from "./checklistUtils";
import type { OpenChecklistEntry } from "@/hooks/useChecklist";
import type { ChecklistItem } from "@/types";
import { daysAgo, fromDateInputValue, startOfLocalDay, toDateInputValue } from "@/utils/dates";
import { formatDate } from "@/utils/formatters";
import { cn } from "@/utils/cn";

export interface ChecklistItemRowProps {
  entry: OpenChecklistEntry;
  graceMs: number;
  /** Compact rendering for small surfaces (tray popover / compact mode). */
  compact?: boolean;
  draggable?: boolean;
  onToggleComplete: (item: ChecklistItem) => void;
  onUndo: (item: ChecklistItem) => void;
  onUpdate?: (item: ChecklistItem, patch: { title?: string; tags?: string[]; dueDate?: number | null }) => void;
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
  const { item, grace } = entry;
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [editingDue, setEditingDue] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  const age = daysAgo(item.created_at);
  const overdue =
    item.completed_at === null &&
    item.due_date !== null &&
    item.due_date < startOfLocalDay(Date.now());

  const commitTitle = () => {
    setEditingTitle(false);
    const { title, tags } = parseInlineTags(titleDraft);
    if (!title || (title === item.title && tags.length === 0)) {
      setTitleDraft(item.title);
      return;
    }
    const merged = [...item.tags.map((tag) => tag.name)];
    for (const tag of tags) {
      if (!merged.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
        merged.push(tag);
      }
    }
    onUpdate?.(item, { title, tags: merged });
  };

  const removeTag = (name: string) => {
    onUpdate?.(item, {
      tags: item.tags.map((tag) => tag.name).filter((existing) => existing !== name),
    });
  };

  const graceProgress = grace ? Math.max(0, Math.min(1, grace.remainingMs / graceMs)) : 0;
  const graceSeconds = grace ? Math.max(0, Math.ceil(grace.remainingMs / 1000)) : 0;

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
        "group relative overflow-hidden rounded-md border transition-all duration-300",
        // Compact surfaces: outline-only card, accent highlight on hover
        // (DESIGN.md interactive-card pattern) — lets the popover glass show through.
        // Full (not /50) opacity so the highlight reads clearly over the blurred
        // glass backdrop instead of blending into it.
        compact
          ? "border-border/60 bg-transparent px-2 py-1.5 hover:border-accent-foreground/20 hover:bg-accent"
          : "bg-card px-3 py-2",
        overdue && "border-destructive/50",
        grace?.leaving && "max-h-0 border-transparent py-0 opacity-0",
        !grace?.leaving && "max-h-[500px] opacity-100",
      )}
      data-testid={`checklist-row-${item.id}`}
    >
      <div className="flex items-center gap-2">
        {draggable && (
          <GripVertical
            className={cn(
              "shrink-0 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100",
              compact ? "h-3.5 w-3.5" : "h-4 w-4",
            )}
          />
        )}

        <button
          type="button"
          onClick={() => (grace ? onUndo(item) : onToggleComplete(item))}
          aria-label={grace ? t("checklist.undo") : t("checklist.complete")}
          className={cn(
            "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-colors",
            grace
              ? "border-green-500 bg-green-500 text-white"
              : "border-muted-foreground/40 hover:border-primary",
          )}
        >
          {grace && <Check className="h-3 w-3" />}
        </button>

        <div className="min-w-0 flex-1">
          {editingTitle && onUpdate ? (
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") {
                  setTitleDraft(item.title);
                  setEditingTitle(false);
                }
              }}
              onBlur={commitTitle}
              className="w-full bg-transparent text-sm outline-none border-b border-primary/50"
            />
          ) : (
            <button
              type="button"
              title={itemTooltip(item)}
              onClick={() => {
                if (!grace && onUpdate) {
                  setTitleDraft(item.title);
                  setEditingTitle(true);
                }
              }}
              className={cn(
                "block w-full whitespace-pre-wrap break-words text-left text-sm",
                grace && "text-muted-foreground line-through",
              )}
            >
              {item.title}
            </button>
          )}

          {compact && tagsOpen && item.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <TagChip key={tag.id} name={tag.name} onClick={onTagClick} />
              ))}
            </div>
          )}

          {!compact && (item.tags.length > 0 || item.due_date !== null || age > 0) && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {item.tags.map((tag) => (
                <span key={tag.id} className="group/tag relative inline-flex">
                  <TagChip name={tag.name} onClick={onTagClick} />
                  {onUpdate && !grace && (
                    <button
                      type="button"
                      onClick={() => removeTag(tag.name)}
                      aria-label={t("checklist.remove_tag", { tag: tag.name })}
                      className="absolute -right-1.5 -top-1.5 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground group-hover/tag:flex"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </span>
              ))}
              {item.due_date !== null && !editingDue && (
                <Badge
                  variant={overdue ? "destructive" : "outline"}
                  className="cursor-pointer gap-1 text-[11px] font-normal"
                  onClick={() => !grace && onUpdate && setEditingDue(true)}
                >
                  <Calendar className="h-3 w-3" />
                  {formatDate(item.due_date, i18n.language)}
                  {overdue && ` · ${t("checklist.overdue")}`}
                </Badge>
              )}
              {age > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {t("checklist.created_days_ago", { count: age })}
                </span>
              )}
            </div>
          )}

          {!compact && editingDue && onUpdate && (
            <input
              type="date"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              defaultValue={item.due_date !== null ? toDateInputValue(item.due_date) : ""}
              onBlur={(e) => {
                setEditingDue(false);
                onUpdate(item, { dueDate: fromDateInputValue(e.target.value) });
              }}
              className="mt-1 rounded border bg-transparent px-1.5 py-0.5 text-xs"
            />
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
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {!compact && onUpdate && item.due_date === null && (
              <button
                type="button"
                onClick={() => setEditingDue(true)}
                title={t("checklist.set_due_date")}
                aria-label={t("checklist.set_due_date")}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Calendar className="h-3.5 w-3.5" />
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

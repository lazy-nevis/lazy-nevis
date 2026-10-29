import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, Flag, Folder, Pencil, Play, Tag as TagIcon, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAnchoredPosition } from "@/components/ui/popover";
import type { ChecklistItem, UpdateChecklistPatch } from "@/types";
import { cn } from "@/utils/cn";
import { useChecklistCategories } from "./CategoryPicker";
import { EntryMenuPanel, type EntryMenuView } from "./EntryMenu";

interface Props {
  item: ChecklistItem;
  x: number;
  y: number;
  onClose: () => void;
  onUpdate?: (item: ChecklistItem, patch: UpdateChecklistPatch) => void;
  onEdit?: () => void;
  onDelete?: (item: ChecklistItem) => void;
  onStartFocus?: (item: ChecklistItem) => void;
}

type View = "root" | EntryMenuView;

/** Floating panel at the pointer; remounted per view so it re-measures and re-flips. */
function Floating({
  x,
  y,
  children,
  onMouseDownCapture,
}: {
  x: number;
  y: number;
  children: ReactNode;
  onMouseDownCapture: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const position = useAnchoredPosition(
    true,
    () => ({ top: y, bottom: y, left: x, right: x }),
    ref,
    "start",
  );
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="menu"
      data-checklist-context-menu=""
      onMouseDownCapture={onMouseDownCapture}
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        maxHeight: position?.maxHeight,
        visibility: position ? "visible" : "hidden",
      }}
      className="fixed z-[95] overflow-y-auto rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
    >
      {children}
    </div>,
    document.body,
  );
}

/** Right-click "quick items" for a checklist row (priority, category, date/time, tags, edit, delete). */
export function ChecklistContextMenu({ item, x, y, onClose, onUpdate, onEdit, onDelete, onStartFocus }: Props) {
  const { t } = useTranslation();
  const categories = useChecklistCategories();
  const [view, setView] = useState<View>("root");
  const isSub = item.parent_id !== null;

  // The panel (and pickers nested in it) render in portals outside any DOM wrapper, so "inside"
  // is tracked through React's tree: synthetic events bubble through portals and run before the
  // bubble-phase document listener below.
  const pressedInside = useRef(false);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      const inside =
        pressedInside.current || Boolean((event.target as Element | null)?.closest("[data-checklist-context-menu]"));
      pressedInside.current = false;
      if (!inside) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const update = (patch: UpdateChecklistPatch) => onUpdate?.(item, patch);
  const tagNames = item.tags.map((tag) => tag.name);

  const rootItem = (
    icon: typeof Flag,
    label: string,
    onClick: () => void,
    opts?: { hint?: string; arrow?: boolean; danger?: boolean },
  ) => {
    const Icon = icon;
    return (
      <button
        key={label}
        type="button"
        role="menuitem"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
          opts?.danger && "text-destructive",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1">{label}</span>
        {opts?.hint && <span className="max-w-24 truncate text-xs text-muted-foreground">{opts.hint}</span>}
        {opts?.arrow && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />}
      </button>
    );
  };

  let body: ReactNode;
  if (view === "root") {
    body = (
      <div role="menu" className="w-56 space-y-0.5">
        {onEdit && rootItem(Pencil, t("checklist.entry.edit"), () => { onClose(); onEdit(); })}
        {onUpdate && (
          <>
            {rootItem(Flag, t("checklist.priority.label"), () => setView("priority"), {
              arrow: true,
              hint: item.priority === "none" ? undefined : t(`checklist.priority.${item.priority}`),
            })}
            {!isSub &&
              rootItem(Folder, t("checklist.category.label"), () => setView("category"), {
                arrow: true,
                hint: item.category?.name,
              })}
            {rootItem(Calendar, t("checklist.entry.due"), () => setView("due"), { arrow: true })}
            {rootItem(TagIcon, t("checklist.entry.tags"), () => setView("tags"), {
              arrow: true,
              hint: tagNames.length ? String(tagNames.length) : undefined,
            })}
          </>
        )}
        {onStartFocus && rootItem(Play, t("checklist.start_focus"), () => { onClose(); onStartFocus(item); })}
        {onDelete && (
          <>
            <div className="my-1 border-t border-border" />
            {rootItem(Trash2, t("common.delete"), () => { onClose(); onDelete(item); }, { danger: true })}
          </>
        )}
      </div>
    );
  } else {
    body = (
      <div>
        <button
          type="button"
          onClick={() => setView("root")}
          className="mb-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t("checklist.entry.back")}
        </button>
        <EntryMenuPanel
          initialView={view}
          close={onClose}
          categories={categories}
          allowCategory={!isSub}
          category={item.category?.name ?? null}
          onCategory={(name) => update({ category: name })}
          priority={item.priority}
          onPriority={(priority) => update({ priority })}
          due={item.due_date === null ? null : { ms: item.due_date, hasTime: item.due_has_time }}
          onDue={(due) =>
            update(due ? { dueDate: due.ms, dueHasTime: due.hasTime } : { dueDate: null, dueHasTime: false })
          }
          tags={tagNames}
          onAddTag={(name) => {
            if (!tagNames.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
              update({ tags: [...tagNames, name] });
            }
          }}
          onRemoveTag={(name) => update({ tags: tagNames.filter((existing) => existing !== name) })}
        />
      </div>
    );
  }

  return (
    <Floating key={view} x={x} y={y} onMouseDownCapture={() => (pressedInside.current = true)}>
      {body}
    </Floating>
  );
}

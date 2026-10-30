import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, X, ChevronRight, Flag, Folder, Tag as TagIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DateTimePanel } from "@/components/ui/date-picker";
import type { ChecklistCategory, ChecklistPriority } from "@/types";
import { CategoryOptionList } from "./CategoryPicker";
import { PriorityOptionList } from "./PriorityFlag";

export type EntryMenuView = "menu" | "priority" | "category" | "due" | "tags";

export interface EntryDue {
  ms: number;
  hasTime: boolean;
}

interface Props {
  initialView: EntryMenuView;
  close: () => void;
  categories: ChecklistCategory[];
  allowCategory: boolean;
  category: string | null;
  onCategory: (name: string | null) => void;
  priority: ChecklistPriority;
  onPriority: (value: ChecklistPriority) => void;
  due: EntryDue | null;
  onDue: (due: EntryDue | null) => void;
  onAddTag: (name: string) => void;
  /** Current tags and a remover; when given, the tags view lists them as removable chips. */
  tags?: string[];
  onRemoveTag?: (name: string) => void;
}

/** Windows narrower than the side-by-side date/time panel (tray popover, compact): it opens full-window instead. */
const NARROW_WINDOW_PX = 440;

function useNarrowWindow(): boolean {
  const [narrow, setNarrow] = useState(() => window.innerWidth < NARROW_WINDOW_PX);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < NARROW_WINDOW_PX);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return narrow;
}

const pad = (n: number) => String(n).padStart(2, "0");

function timeValue(ms: number): string {
  const date = new Date(ms);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Contents of the floating "+" / chip popover. Every view renders inside the same
 * fixed-position panel, so nothing here ever pushes the card layout.
 */
export function EntryMenuPanel({
  initialView,
  close,
  categories,
  allowCategory,
  category,
  onCategory,
  priority,
  onPriority,
  due,
  onDue,
  onAddTag,
  tags,
  onRemoveTag,
}: Props) {
  const { t } = useTranslation();
  const [view, setView] = useState<EntryMenuView>(initialView);
  const [tagDraft, setTagDraft] = useState("");
  const fromMenu = initialView === "menu";
  const narrow = useNarrowWindow();

  const back = fromMenu && view !== "menu" && (
    <button
      type="button"
      onClick={() => setView("menu")}
      className="mb-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
      {t("checklist.entry.back")}
    </button>
  );

  if (view === "menu") {
    const items: { id: EntryMenuView; icon: typeof Flag; label: string; hint?: string; hidden?: boolean }[] = [
      {
        id: "priority",
        icon: Flag,
        label: t("checklist.priority.label"),
        hint: priority === "none" ? undefined : t(`checklist.priority.${priority}`),
      },
      {
        id: "category",
        icon: Folder,
        label: t("checklist.category.label"),
        hint: category ?? undefined,
        hidden: !allowCategory,
      },
      { id: "due", icon: Calendar, label: t("checklist.entry.due") },
      { id: "tags", icon: TagIcon, label: t("checklist.entry.tags") },
    ];
    return (
      <div role="menu" className="w-56 space-y-0.5">
        {items
          .filter((item) => !item.hidden)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => setView(item.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
            >
              <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.hint && <span className="max-w-24 truncate text-xs text-muted-foreground">{item.hint}</span>}
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
            </button>
          ))}
      </div>
    );
  }

  if (view === "priority") {
    return (
      <div className="w-52">
        {back}
        <PriorityOptionList
          value={priority}
          onChange={(next) => {
            onPriority(next);
            close();
          }}
        />
      </div>
    );
  }

  if (view === "category") {
    return (
      <div className="w-52">
        {back}
        <CategoryOptionList
          categories={categories}
          value={category}
          onChange={(name) => {
            onCategory(name);
            close();
          }}
        />
      </div>
    );
  }

  if (view === "tags") {
    const commit = () => {
      const name = tagDraft.trim().replace(/^#/, "").replace(/\s+/g, "-");
      if (!name) return;
      onAddTag(name);
      setTagDraft("");
      close();
    };
    return (
      <div className="w-52">
        {back}
        {tags && tags.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {tags.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]"
              >
                #{name}
                {onRemoveTag && (
                  <button
                    type="button"
                    aria-label={`${t("common.delete")} #${name}`}
                    onClick={() => onRemoveTag(name)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={t("checklist.entry.tag_placeholder")}
          aria-label={t("checklist.entry.tags")}
          className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:border-primary"
        />
      </div>
    );
  }

  // due
  const selected = due ? new Date(due.ms) : null;
  const onPanel = (day: Date, time: string | null) => {
    const base = new Date(day);
    const [hours, minutes] = (time ?? "").split(":").map(Number);
    const hasTime = time !== null && !Number.isNaN(hours) && !Number.isNaN(minutes);
    if (hasTime) base.setHours(hours, minutes, 0, 0);
    else base.setHours(0, 0, 0, 0);
    onDue({ ms: base.getTime(), hasTime });
  };

  const panel = (
    <DateTimePanel
      stacked={narrow}
      date={selected}
      time={due?.hasTime && selected ? timeValue(due.ms) : null}
      onChange={onPanel}
      onClear={
        due
          ? () => {
              onDue(null);
              close();
            }
          : undefined
      }
    />
  );

  if (narrow) {
    // A native window can't be drawn past, so the picker takes the whole window like a modal.
    return createPortal(
      <div
        role="dialog"
        aria-label={t("checklist.entry.due")}
        // The parent popover closes on outside mousedown at document level; keep this one inside.
        onMouseDown={(e) => e.nativeEvent.stopImmediatePropagation()}
        className="fixed inset-0 z-[100] overflow-y-auto bg-popover p-3 text-popover-foreground"
      >
        <button
          type="button"
          onClick={close}
          aria-label={t("common.close")}
          title={t("common.close")}
          className="mb-2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        {panel}
      </div>,
      document.body,
    );
  }

  return (
    <div className="space-y-2">
      {back}
      {panel}
    </div>
  );
}

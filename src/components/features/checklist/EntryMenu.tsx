import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Flag, Folder, Tag as TagIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CalendarGrid } from "@/components/ui/date-picker";
import type { ChecklistCategory, ChecklistPriority } from "@/types";
import { startOfLocalDay } from "@/utils/dates";
import { cn } from "@/utils/cn";
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
}: Props) {
  const { t } = useTranslation();
  const [view, setView] = useState<EntryMenuView>(initialView);
  const [tagDraft, setTagDraft] = useState("");
  const fromMenu = initialView === "menu";

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
  const pickDay = (day: Date) => {
    const base = new Date(day);
    if (due?.hasTime && selected) base.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    onDue({ ms: base.getTime(), hasTime: Boolean(due?.hasTime) });
  };
  const setTime = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return;
    const base = new Date(due ? startOfLocalDay(due.ms) : startOfLocalDay(Date.now()));
    base.setHours(hours, minutes, 0, 0);
    onDue({ ms: base.getTime(), hasTime: true });
  };
  const shortcut = (offsetDays: number) => {
    const day = new Date(startOfLocalDay(Date.now()));
    day.setDate(day.getDate() + offsetDays);
    pickDay(day);
  };
  const chipClass =
    "rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-accent";

  return (
    <div className="w-[248px] space-y-2">
      {back}
      <div className="flex gap-1.5">
        <button type="button" className={chipClass} onClick={() => shortcut(0)}>
          {t("pickers.today")}
        </button>
        <button type="button" className={chipClass} onClick={() => shortcut(1)}>
          {t("checklist.groups.tomorrow")}
        </button>
      </div>
      <CalendarGrid value={selected} weekStart={1} onSelect={pickDay} />
      <div className="flex items-center gap-2 border-t border-border pt-2">
        <label className="flex flex-1 items-center gap-2 text-xs text-muted-foreground">
          {t("checklist.entry.time")}
          <input
            type="time"
            value={due?.hasTime ? timeValue(due.ms) : ""}
            onChange={(e) => setTime(e.target.value)}
            className="h-7 flex-1 rounded-md border border-input bg-transparent px-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </label>
        <button
          type="button"
          disabled={!due}
          onClick={() => {
            onDue(null);
            close();
          }}
          className={cn(chipClass, "disabled:opacity-40")}
        >
          {t("pickers.clear")}
        </button>
      </div>
    </div>
  );
}

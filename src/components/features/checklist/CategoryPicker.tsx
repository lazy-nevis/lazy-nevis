import { useEffect, useState } from "react";
import { Check, Plus, Settings as SettingsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { appModeService } from "@/services/tauri";
import { requestSettingsTab } from "@/utils/settingsNav";
import { checklistService } from "@/services/tauri";
import type { ChecklistCategory } from "@/types";
import { toTone, toneStyle } from "@/utils/tones";
import { cn } from "@/utils/cn";

const CATEGORIES_CHANGED = "lazynevis:categories-changed";

/** Loads the user's categories and refreshes when one is created here or in another window. */
export function useChecklistCategories(): ChecklistCategory[] {
  const [categories, setCategories] = useState<ChecklistCategory[]>([]);
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    const load = () =>
      void checklistService
        .listCategories()
        .then((list) => {
          if (!cancelled) setCategories(list);
        })
        .catch(() => {});
    load();
    window.addEventListener(CATEGORIES_CHANGED, load);
    listen("checklist:changed", load)
      .then((un) => {
        if (cancelled) un();
        else unlisten = un;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      window.removeEventListener(CATEGORIES_CHANGED, load);
      unlisten?.();
    };
  }, []);
  return categories;
}

interface CategoryOptionListProps {
  categories: ChecklistCategory[];
  /** Selected category name (case-insensitive) or null for none. */
  value: string | null;
  onChange: (name: string | null) => void;
}

/** Listbox rendered inside a floating panel; the selected category is highlighted. */
export function CategoryOptionList({ categories, value, onChange }: CategoryOptionListProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(false);

  const create = () => {
    const name = draft.trim();
    if (!name) return;
    const existing = categories.find((cat) => cat.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      onChange(existing.name);
      return;
    }
    void checklistService
      .createCategory(name)
      .then((created) => {
        window.dispatchEvent(new Event(CATEGORIES_CHANGED));
        setDraft("");
        onChange(created.name);
      })
      .catch(() => setError(true));
  };

  const openSettings = () => {
    requestSettingsTab("checklist");
    void appModeService.openSecondary("settings").catch(() => {});
  };
  const selectedName = value?.toLowerCase() ?? null;
  const row = (key: string, label: string, selected: boolean, onPick: () => void, tone?: string) => (
    <button
      key={key}
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
        selected && "bg-accent font-medium",
      )}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          tone ? "tone-dot" : "border border-muted-foreground/50",
        )}
        style={tone ? toneStyle(toTone(tone)) : undefined}
        aria-hidden
      />
      <span className="flex-1 truncate">{label}</span>
      {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
    </button>
  );

  return (
    <div>
      <div
        role="listbox"
        aria-label={t("checklist.category.label")}
        className="max-h-44 space-y-0.5 overflow-y-auto"
      >
        {row("none", t("checklist.category.none"), selectedName === null, () => onChange(null))}
        {categories.map((cat) =>
          row(cat.id, cat.name, selectedName === cat.name.toLowerCase(), () => onChange(cat.name), cat.tone),
        )}
      </div>
      <div className="mt-1 flex items-center gap-1 border-t border-border pt-1.5">
        <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              create();
            }
          }}
          placeholder={t("checklist.category.create_placeholder")}
          aria-label={t("checklist.category.create_placeholder")}
          aria-invalid={error}
          className="h-7 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <button
        type="button"
        onClick={openSettings}
        className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <SettingsIcon className="h-3 w-3" aria-hidden />
        {t("checklist.category.manage")}
      </button>
    </div>
  );
}

export function CategoryChip({ category }: { category: ChecklistCategory }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] tone-border"
      style={toneStyle(toTone(category.tone))}
    >
      <span className="tone-dot h-1.5 w-1.5 rounded-full" />
      {category.name}
    </span>
  );
}

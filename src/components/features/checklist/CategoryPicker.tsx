import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { checklistService } from "@/services/tauri";
import type { ChecklistCategory } from "@/types";
import { toTone, toneStyle } from "@/utils/tones";
import { cn } from "@/utils/cn";

/** Loads the user's categories once; the list is small and rarely changes while a card is open. */
export function useChecklistCategories(): ChecklistCategory[] {
  const [categories, setCategories] = useState<ChecklistCategory[]>([]);
  useEffect(() => {
    let cancelled = false;
    void checklistService
      .listCategories()
      .then((list) => {
        if (!cancelled) setCategories(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
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
    <div
      role="listbox"
      aria-label={t("checklist.category.label")}
      className="max-h-56 space-y-0.5 overflow-y-auto"
    >
      {row("none", t("checklist.category.none"), selectedName === null, () => onChange(null))}
      {categories.map((cat) =>
        row(cat.id, cat.name, selectedName === cat.name.toLowerCase(), () => onChange(cat.name), cat.tone),
      )}
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

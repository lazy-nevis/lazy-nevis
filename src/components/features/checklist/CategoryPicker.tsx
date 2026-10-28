import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "@/components/ui/select";
import { checklistService } from "@/services/tauri";
import type { ChecklistCategory } from "@/types";
import { toneStyle, type Tone } from "@/utils/tones";
import { cn } from "@/utils/cn";

interface Props {
  value: ChecklistCategory | null;
  onChange: (name: string | null) => void;
  disabled?: boolean;
}

function CategoryOptionLabel({ name, tone }: { name: string; tone?: Tone }) {
  return (
    <span className="flex items-center gap-1.5">
      {tone && <span className="tone-dot h-1.5 w-1.5 shrink-0 rounded-full" style={toneStyle(tone)} aria-hidden />}
      {name}
    </span>
  );
}

export function CategoryPicker({ value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<ChecklistCategory[]>([]);

  useEffect(() => {
    void checklistService.listCategories().then(setCategories).catch(() => {});
  }, []);

  return (
    <Select
      disabled={disabled}
      value={value?.id ?? ""}
      onChange={(e) => {
        const selected = categories.find((cat) => cat.id === e.target.value);
        onChange(selected?.name ?? null);
      }}
      className="w-32 [&>button]:h-6 [&>button]:rounded-full [&>button]:px-2.5 [&>button]:py-0 [&>button]:text-[11px]"
      aria-label={t("checklist.category.label")}
    >
      <option value="">{t("checklist.category.none")}</option>
      {categories.map((cat) => (
        <option key={cat.id} value={cat.id}>
          <CategoryOptionLabel name={cat.name} tone={cat.tone as Tone} />
        </option>
      ))}
    </Select>
  );
}

export function CategoryChip({ category }: { category: ChecklistCategory }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] tone-border")}
      style={toneStyle(category.tone as import("@/utils/tones").Tone)}
    >
      <span className="tone-dot h-1.5 w-1.5 rounded-full" />
      {category.name}
    </span>
  );
}

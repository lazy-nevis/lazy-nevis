import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checklistService } from "@/services/tauri";
import type { ChecklistCategory } from "@/types";
import { TONES, toTone } from "@/utils/tones";
import { cn } from "@/utils/cn";

export function CategoryManager() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<ChecklistCategory[]>([]);
  const [newName, setNewName] = useState("");

  const refresh = () => {
    void checklistService.listCategories().then(setCategories).catch(() => {});
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{t("checklist.category.manage_title")}</h3>
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t("checklist.category.new_placeholder")}
        />
        <Button
          type="button"
          onClick={() => {
            if (!newName.trim()) return;
            void checklistService.createCategory(newName.trim()).then(() => {
              setNewName("");
              refresh();
            });
          }}
        >
          {t("checklist.category.add")}
        </Button>
      </div>
      <ul className="space-y-2">
        {categories.map((cat) => (
          <li
            key={cat.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2 shadow-sm"
          >
            <Input
              value={cat.name}
              onChange={(e) =>
                setCategories((list) =>
                  list.map((row) => (row.id === cat.id ? { ...row, name: e.target.value } : row)),
                )
              }
              onBlur={() => void checklistService.updateCategory(cat.id, cat.name, cat.tone).then(refresh)}
              className="flex-1"
            />
            <div className="flex shrink-0 flex-wrap gap-1.5">
              {TONES.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  className={cn(
                    "h-5 w-5 rounded-full border-2 transition-transform",
                    toTone(cat.tone) === tone ? "border-foreground scale-105" : "border-transparent",
                  )}
                  style={{ background: `hsl(var(--tone-${tone}))` }}
                  onClick={() => void checklistService.updateCategory(cat.id, cat.name, tone).then(refresh)}
                  aria-label={tone}
                  aria-pressed={toTone(cat.tone) === tone}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                if (!window.confirm(t("checklist.category.delete_confirm", { name: cat.name }))) return;
                void checklistService.deleteCategory(cat.id).then(refresh);
              }}
            >
              {t("common.delete")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

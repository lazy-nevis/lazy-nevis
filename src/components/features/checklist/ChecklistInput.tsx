import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CreateChecklistInput } from "@/types";
import { cn } from "@/utils/cn";
import { ChecklistEntryCard } from "./ChecklistEntryCard";

interface Props {
  onCreate: (input: CreateChecklistInput) => Promise<unknown>;
  autoFocus?: boolean;
  parentId?: string;
  compact?: boolean;
}

/** "Add item" affordance that expands into the entry card (Todoist-style). */
export function ChecklistInput({ onCreate, autoFocus = false, parentId, compact = false }: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(autoFocus);
  const close = useCallback(() => setEditing(false), []);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-1 py-2 text-sm text-muted-foreground transition-colors hover:text-primary",
          compact && "py-1.5 text-xs",
          parentId && "ml-6 w-[calc(100%-1.5rem)]",
        )}
      >
        <Plus className={cn("h-4 w-4 text-primary", compact && "h-3.5 w-3.5")} />
        {parentId ? t("checklist.add_sub_item") : t("checklist.add_item")}
      </button>
    );
  }

  return (
    <div className={cn(parentId && "ml-6", "py-1")}>
      <ChecklistEntryCard
        mode="create"
        compact={compact}
        allowCategory={!parentId}
        onCancel={close}
        onSubmit={(values) =>
          onCreate({
            title: values.title,
            tags: values.tags,
            dueDate: values.dueDate,
            dueHasTime: values.dueHasTime,
            category: values.category,
            priority: values.priority,
            parentId: parentId ?? null,
          })
        }
      />
    </div>
  );
}

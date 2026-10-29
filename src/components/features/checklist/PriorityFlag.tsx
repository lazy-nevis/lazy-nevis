import { Check, Flag } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ChecklistPriority } from "@/types";
import { cn } from "@/utils/cn";

const TONE_CLASS: Record<ChecklistPriority, string> = {
  urgent: "text-[hsl(var(--tone-rose))]",
  high: "text-[hsl(var(--tone-orange))]",
  medium: "text-[hsl(var(--tone-sky))]",
  low: "text-[hsl(var(--tone-slate))]",
  none: "text-muted-foreground",
};

/** Ring color for the round checkbox (Todoist-style priority cue). */
export const PRIORITY_RING_CLASS: Record<ChecklistPriority, string> = {
  urgent: "border-[hsl(var(--tone-rose))] bg-[hsl(var(--tone-rose)/0.12)]",
  high: "border-[hsl(var(--tone-orange))] bg-[hsl(var(--tone-orange)/0.12)]",
  medium: "border-[hsl(var(--tone-sky))] bg-[hsl(var(--tone-sky)/0.12)]",
  low: "border-[hsl(var(--tone-slate))]",
  none: "border-muted-foreground/50",
};

export const PRIORITY_LEVELS: ChecklistPriority[] = ["urgent", "high", "medium", "low", "none"];

interface PriorityOptionListProps {
  value: ChecklistPriority;
  onChange: (value: ChecklistPriority) => void;
}

/** Listbox rendered inside a floating panel; the selected level is highlighted. */
export function PriorityOptionList({ value, onChange }: PriorityOptionListProps) {
  const { t } = useTranslation();
  return (
    <div role="listbox" aria-label={t("checklist.priority.label")} className="space-y-0.5">
      {PRIORITY_LEVELS.map((level) => {
        const selected = level === value;
        return (
          <button
            key={level}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onChange(level)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
              selected && "bg-accent font-medium",
            )}
          >
            <Flag className={cn("h-4 w-4 shrink-0", TONE_CLASS[level])} aria-hidden />
            <span className="flex-1">{t(`checklist.priority.${level}`)}</span>
            {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

export function PriorityFlag({ priority }: { priority: ChecklistPriority }) {
  if (priority === "none") return null;
  return <Flag className={cn("h-3.5 w-3.5 shrink-0", TONE_CLASS[priority])} aria-hidden />;
}

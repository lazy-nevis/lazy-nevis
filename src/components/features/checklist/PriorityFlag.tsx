import { Flag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Select } from "@/components/ui/select";
import type { ChecklistPriority } from "@/types";
import { cn } from "@/utils/cn";

const TONE_CLASS: Record<ChecklistPriority, string> = {
  urgent: "tone-text text-[hsl(var(--tone-rose))]",
  high: "tone-text text-[hsl(var(--tone-orange))]",
  medium: "tone-text text-[hsl(var(--tone-sky))]",
  low: "tone-text text-[hsl(var(--tone-slate))]",
  none: "",
};

interface PriorityMenuProps {
  value: ChecklistPriority;
  onChange: (value: ChecklistPriority) => void;
  disabled?: boolean;
}

const LEVELS: ChecklistPriority[] = ["urgent", "high", "medium", "low", "none"];

export function PriorityMenu({ value, onChange, disabled }: PriorityMenuProps) {
  const { t } = useTranslation();
  return (
    <Select
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value as ChecklistPriority)}
      className="w-28 [&>button]:h-7 [&>button]:px-2 [&>button]:text-[11px]"
      aria-label={t("checklist.priority.label")}
    >
      {LEVELS.map((level) => (
        <option key={level} value={level}>{t(`checklist.priority.${level}`)}</option>
      ))}
    </Select>
  );
}

export function PriorityFlag({ priority }: { priority: ChecklistPriority }) {
  if (priority === "none") return null;
  return <Flag className={cn("h-3.5 w-3.5 shrink-0", TONE_CLASS[priority])} aria-hidden />;
}

import { useTranslation } from "react-i18next";
import type { CalendarKind } from "@/types";
import { cn } from "@/utils/cn";
import { calendarKindTone } from "@/components/features/calendar/calendarKindTone";
import { toneStyle } from "@/utils/tones";

const ALL_KINDS: CalendarKind[] = [
  "session",
  "pomodoro_run",
  "habit_log",
  "habit_day",
  "checklist_completed",
  "checklist_due",
  "reminder_occurrence",
];

export interface KindFilterProps {
  visible: CalendarKind[];
  onChange: (next: CalendarKind[]) => void;
}

export function KindFilter({ visible, onChange }: KindFilterProps) {
  const { t } = useTranslation(undefined, { keyPrefix: "calendar.kinds" });

  const toggle = (kind: CalendarKind) => {
    if (visible.includes(kind)) {
      const next = visible.filter((k) => k !== kind);
      onChange(next.length > 0 ? next : [kind]);
    } else {
      onChange([...visible, kind]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t("filter_label")}>
      {ALL_KINDS.map((kind) => {
        const active = visible.includes(kind);
        const tone = calendarKindTone(kind);
        return (
          <button
            key={kind}
            type="button"
            onClick={() => toggle(kind)}
            style={active ? toneStyle(tone) : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "tone-soft tone-border border-transparent text-foreground"
                : "border-border text-muted-foreground hover:bg-muted/50",
            )}
          >
            {t(kind)}
          </button>
        );
      })}
    </div>
  );
}

import { useTranslation } from "react-i18next";
import { Check, ListFilter } from "lucide-react";
import type { CalendarKind } from "@/types";
import { cn } from "@/utils/cn";
import { Popover } from "@/components/ui/popover";
import { calendarKindTone } from "@/components/features/calendar/calendarKindTone";
import { toneStyle } from "@/utils/tones";

export const ALL_KINDS: CalendarKind[] = [
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

/** Toolbar button that opens a checklist of calendar kinds. At least one kind stays visible. */
export function KindFilter({ visible, onChange }: KindFilterProps) {
  const { t } = useTranslation(undefined, { keyPrefix: "calendar.kinds" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "calendar" });
  const filtered = visible.length < ALL_KINDS.length;

  const toggle = (kind: CalendarKind) => {
    if (visible.includes(kind)) {
      const next = visible.filter((k) => k !== kind);
      onChange(next.length > 0 ? next : [kind]);
    } else {
      onChange(ALL_KINDS.filter((k) => k === kind || visible.includes(k)));
    }
  };

  return (
    <Popover
      align="end"
      ariaLabel={t("filter_label")}
      triggerClassName={cn("gap-1.5", filtered && "border-brand/50 text-foreground")}
      className="w-60 p-1.5"
      trigger={
        <>
          <ListFilter className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span>{tc("filter_button")}</span>
          {filtered && (
            <span className="rounded-full bg-brand/15 px-1.5 text-[11px] font-semibold tabular-nums text-brand">
              {visible.length}/{ALL_KINDS.length}
            </span>
          )}
        </>
      }
    >
      {() => (
        <div role="group" aria-label={t("filter_label")} className="flex flex-col">
          {ALL_KINDS.map((kind) => {
            const active = visible.includes(kind);
            const tone = calendarKindTone(kind);
            return (
              <button
                key={kind}
                type="button"
                role="menuitemcheckbox"
                aria-checked={active}
                onClick={() => toggle(kind)}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn("tone-dot h-2.5 w-2.5 shrink-0 rounded-full", !active && "opacity-30")}
                  style={toneStyle(tone)}
                  aria-hidden
                />
                <span className={cn("flex-1 truncate", !active && "text-muted-foreground")}>{t(kind)}</span>
                {active && <Check className="h-3.5 w-3.5 text-brand" aria-hidden />}
              </button>
            );
          })}
          <div className="mt-1 border-t border-border pt-1">
            <button
              type="button"
              disabled={!filtered}
              onClick={() => onChange(ALL_KINDS)}
              className="w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-brand hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
            >
              {tc("filter_show_all")}
            </button>
          </div>
        </div>
      )}
    </Popover>
  );
}

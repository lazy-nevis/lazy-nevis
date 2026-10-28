import { Check, Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatProgressLine } from "@/components/features/habits/habitFormat";
import { useHabits } from "@/hooks/useHabits";
import { habitService } from "@/services/tauri";
import { toneColor, toneStyle, toTone } from "@/utils/tones";

/** Today's habits for Compact Mode; logging opens the quick-log window. */
export function HabitCompactList() {
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });
  const { today } = useHabits();
  const cards = today?.cards ?? [];

  if (cards.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title={t("empty_today")}
        className="border-none bg-transparent py-3 shadow-none"
      />
    );
  }

  return (
    <ul className="space-y-1.5">
      {cards.map(({ habit, progress }) => {
        const tone = toTone(habit.tone);
        const met = progress.status === "met";
        const percent = Math.min(100, Math.round(progress.percent));
        return (
          <li
            key={habit.id}
            className="tone-border flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2"
            style={toneStyle(tone)}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-1.5">
                {met && <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />}
                <p className="truncate text-sm font-medium">{habit.name}</p>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {formatProgressLine(progress.per_target)}
              </p>
              <div className="h-1 overflow-hidden rounded-full bg-muted/80">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${percent}%`, backgroundColor: toneColor(tone, 0.9) }}
                />
              </div>
            </div>
            <Button
              type="button"
              size="xs"
              variant="brand"
              onClick={() => void habitService.openQuickLog(habit.id)}
            >
              {t("log")}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

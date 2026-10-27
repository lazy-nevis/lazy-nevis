import { Check, Flame, MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GlowCard } from "@/components/ui/glow-card";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { formatProgressLine, isCheckOnly, periodLabel } from "@/components/features/habits/habitFormat";
import type { HabitTodayCard } from "@/types";
import { toneColor, toneStyle, toTone } from "@/utils/tones";
import { cn } from "@/utils/cn";
import { habitIcon } from "@/components/features/habits/habitIcons";

export function HabitCard({
  card,
  onLog,
  onMarkDone,
  onEdit,
  onToggleActive,
  onOpenHistory,
}: {
  card: HabitTodayCard;
  onLog: () => void;
  onMarkDone: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onOpenHistory: () => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });
  const { habit, progress, streak_current } = card;
  const met = progress.status === "met";
  const checkOnly = isCheckOnly(habit);
  const tone = toTone(habit.tone);
  const percent = Math.min(100, Math.round(progress.percent));
  const Icon = habitIcon(habit.icon);

  return (
    <GlowCard
      tone={tone}
      className={cn(
        "motion-safe:transition-shadow",
        met && "ring-1 ring-success/40",
      )}
      header={
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {periodLabel(habit.period, t)}
          </span>
          <DropdownMenu
            align="end"
            trigger={
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t("menu_edit")}
                className="h-8 w-8"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            }
            items={[
              { id: "edit", label: t("menu_edit"), onSelect: onEdit },
              { id: "history", label: t("menu_history"), onSelect: onOpenHistory },
              { id: "log", label: t("menu_log_with_note"), onSelect: onLog },
              {
                id: "toggle",
                label: habit.active ? t("menu_deactivate") : t("menu_activate"),
                onSelect: onToggleActive,
              },
            ]}
          />
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-warning" aria-hidden />
            {t("streak_days", { count: streak_current })}
          </span>
          <Button type="button" size="sm" variant="brand" onClick={checkOnly ? onMarkDone : onLog}>
            {checkOnly ? t("mark_done") : t("log")}
          </Button>
        </div>
      }
    >
      <div className="tone-soft space-y-3 rounded-lg border border-transparent p-3" style={toneStyle(tone)}>
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              met ? "bg-success/15 text-success" : "bg-background/60",
            )}
            aria-hidden
          >
            {met ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-base font-semibold leading-snug">{habit.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatProgressLine(progress.per_target)}
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("card_progress")}</span>
            <span className="tabular-nums font-medium text-foreground">{percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted/80">
            <div
              className="h-full rounded-full motion-safe:transition-[width]"
              style={{
                width: `${percent}%`,
                backgroundColor: toneColor(tone, 0.9),
              }}
            />
          </div>
        </div>
      </div>
    </GlowCard>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HabitCard } from "@/components/features/habits/HabitCard";
import { HabitEditorDialog } from "@/components/features/habits/HabitEditorDialog";
import { HabitLogPopover } from "@/components/features/habits/HabitLogPopover";
import { HabitAllHabitsList } from "@/components/features/habits/HabitAllHabitsList";
import { HabitReportsPanel } from "@/components/features/habits/HabitReports";
import { HabitSkyline } from "@/components/features/habits/HabitSkyline";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useHabits } from "@/hooks/useHabits";
import { useSettings } from "@/hooks/useSettings";
import { audioService, habitService } from "@/services/tauri";
import type { Habit, HabitLogInput, HabitTodayCard } from "@/types";
import { celebrate } from "@/components/ui/motion";
import { useUiStore } from "@/stores/uiStore";

type View = "today" | "all" | "reports";

export function Habits() {
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { today, all, refresh } = useHabits();
  const [view, setView] = useState<View>("today");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [logTarget, setLogTarget] = useState<{ card: HabitTodayCard; anchor: HTMLElement } | null>(null);
  const loggedRef = useRef(false);
  const previousMet = useRef<number | null>(null);
  const [builtinSounds, setBuiltinSounds] = useState<string[]>([]);
  const addToast = useUiStore((s) => s.addToast);
  const weekStart = settings.general.week_start ?? 1;

  useEffect(() => {
    void audioService.listBuiltin().then(setBuiltinSounds).catch(() => setBuiltinSounds([]));
  }, []);

  const skylineRange = useMemo(() => {
    const to = Date.now();
    const from = to - 365 * 86_400_000;
    return { from, to };
  }, []);

  const [skyline, setSkyline] = useState<{ date: string; value: number }[]>([]);
  useEffect(() => {
    void habitService
      .daySeries(null, skylineRange.from, skylineRange.to)
      .then(setSkyline)
      .catch(() => setSkyline([]));
  }, [skylineRange.from, skylineRange.to, today]);

  // Big celebration when a log completes the last open habit of the day.
  useEffect(() => {
    if (!today) return;
    const previous = previousMet.current;
    previousMet.current = today.met_count;
    if (!loggedRef.current) return;
    loggedRef.current = false;
    if (
      previous != null &&
      today.total_active > 0 &&
      previous < today.total_active &&
      today.met_count >= today.total_active
    ) {
      celebrate(null, "large");
    }
  }, [today]);

  /** Returns true when the log was saved; failures surface as an error toast. */
  const handleLog = async (habitId: string, input: HabitLogInput): Promise<boolean> => {
    try {
      loggedRef.current = true;
      await habitService.log(habitId, input);
      addToast(t("logged_toast"));
      await refresh();
      return true;
    } catch {
      loggedRef.current = false;
      addToast(t("log_error_toast"), "error");
      return false;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button type="button" variant="brand" onClick={() => { setEditing(null); setEditorOpen(true); }}>
            {t("new_habit")}
          </Button>
        }
      />
      <SegmentedControl
        aria-label={t("title")}
        value={view}
        onChange={setView}
        options={[
          { value: "today", label: t("views.today") },
          { value: "all", label: t("views.all") },
          { value: "reports", label: t("views.reports") },
        ]}
      />

      {view === "today" && (
        <div className="space-y-4">
          {today && (
            <p className="text-sm text-muted-foreground">
              {t("today_summary", { met: today.met_count, total: today.total_active })}
            </p>
          )}
          <SectionCard title={t("skyline_overview")} className="overflow-hidden">
            <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/30 p-2">
              <HabitSkyline points={skyline} weekStart={weekStart} unit={t("units.times")} />
            </div>
          </SectionCard>
          {today?.cards.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {today.cards.map((card) => (
                <HabitCard
                  key={card.habit.id}
                  card={card}
                  onLog={(anchor) =>
                    setLogTarget((prev) =>
                      prev?.card.habit.id === card.habit.id ? null : { card, anchor },
                    )
                  }
                  onMarkDone={() =>
                    void handleLog(card.habit.id, {
                      values: card.habit.targets
                        .filter((t) => t.archived_at == null)
                        .map((target) => ({ target_id: target.id, value: 1 })),
                      logged_at: Date.now(),
                      source: "card",
                    })
                  }
                  onEdit={() => { setEditing(card.habit); setEditorOpen(true); }}
                  onToggleActive={() =>
                    void habitService.setActive(card.habit.id, !card.habit.active).then(refresh)
                  }
                  onOpenHistory={() => navigate(`/habits/${card.habit.id}`)}
                />
              ))}
            </div>
          ) : (
            <EmptyState title={t("empty_today")} />
          )}
        </div>
      )}

      {view === "all" && (
        <div className="space-y-2">
          {all.length === 0 ? (
            <EmptyState title={t("empty_all")} />
          ) : (
            <HabitAllHabitsList
              habits={all}
              onChanged={refresh}
              onEdit={(habit) => {
                setEditing(habit);
                setEditorOpen(true);
              }}
            />
          )}
        </div>
      )}

      {view === "reports" && <HabitReportsPanel />}

      <HabitEditorDialog
        open={editorOpen}
        habit={editing}
        weekStart={weekStart}
        locale={settings.general.language}
        defaultChannels={settings.delivery.habits}
        defaultSound={settings.delivery.habit_sound}
        builtinSounds={builtinSounds}
        onClose={() => setEditorOpen(false)}
        onSave={async (input) => {
          if (editing) await habitService.update(editing.id, input);
          else await habitService.create(input);
          await refresh();
        }}
      />

      <AnimatePresence>
        {logTarget && (
          <HabitLogPopover
            key={logTarget.card.habit.id}
            anchor={logTarget.anchor}
            habit={logTarget.card.habit}
            progress={logTarget.card.progress.per_target}
            onClose={() => setLogTarget(null)}
            onSubmit={async (input) => {
              const ok = await handleLog(logTarget.card.habit.id, input);
              if (ok) setLogTarget(null);
            }}
          />
        )}
      </AnimatePresence>
    </PageContainer>
  );
}

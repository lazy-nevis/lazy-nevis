import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { CycleDots } from "@/components/features/pomodoro/CycleDots";
import { PomodoroControls } from "@/components/features/pomodoro/PomodoroControls";
import { PomodoroHistory } from "@/components/features/pomodoro/PomodoroHistory";
import { PomodoroStartDialog } from "@/components/features/pomodoro/PomodoroStartDialog";
import { PomodoroStats } from "@/components/features/pomodoro/PomodoroStats";
import { RingTimer } from "@/components/features/pomodoro/RingTimer";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { SectionCard } from "@/components/ui/section-card";
import { usePomodoro } from "@/hooks/usePomodoro";
import { useSettings } from "@/hooks/useSettings";
import { pomodoroService } from "@/services/tauri";
import { usePomodoroStore } from "@/stores/pomodoroStore";

export function Pomodoro() {
  const { t } = useTranslation(undefined, { keyPrefix: "pomodoro" });
  const { settings } = useSettings();
  const { state } = usePomodoro();
  const setState = usePomodoroStore((s) => s.setState);
  const [startOpen, setStartOpen] = useState(false);

  const refresh = useCallback(async () => {
    setState(await pomodoroService.getState());
  }, [setState]);

  const runAction = async (fn: () => Promise<import("@/types").PomodoroState>) => {
    setState(await fn());
  };

  if (!settings.pomodoro.enabled) {
    return (
      <PageContainer>
        <PageHeader title={t("page.title")} description={t("page.disabled")} />
      </PageContainer>
    );
  }

  const phase = state?.phase ?? null;
  const phaseLabel = phase
    ? t(`phase.${phase.kind}`)
    : t("phase.idle");

  return (
    <PageContainer>
      <PageHeader title={t("page.title")} description={t("page.description")} />
      <SectionCard title={t("widget.title")} description={t("page.description")}>
        <div className="flex flex-col items-center gap-6 py-2">
          <RingTimer
            remainingMs={state?.remaining_ms ?? 0}
            elapsedMs={state?.elapsed_ms ?? 0}
            plannedMs={phase?.planned_ms ?? settings.pomodoro.focus_ms}
            phaseKind={phase?.kind ?? null}
            phaseLabel={phaseLabel}
          />
          <CycleDots
            completed={state?.focus_completed_in_set ?? 0}
            total={state?.long_break_every ?? settings.pomodoro.long_break_every}
          />
          <p className="text-sm text-muted-foreground">
            {t("today_progress", {
              done: state?.today_completed ?? 0,
              goal: state?.daily_goal ?? settings.pomodoro.daily_goal,
            })}
          </p>
          <PomodoroControls
            runState={state?.state ?? null}
            hasRun={Boolean(state?.run)}
            onStart={() => setStartOpen(true)}
            onPause={() => void runAction(() => pomodoroService.pause())}
            onResume={() => void runAction(() => pomodoroService.resume())}
            onSkip={() => void runAction(() => pomodoroService.skipPhase())}
            onStop={() => void runAction(() => pomodoroService.stop())}
            onStartNext={() => void runAction(() => pomodoroService.startNext())}
          />
        </div>
      </SectionCard>
      <PomodoroStats
        refreshKey={`${state?.today_completed ?? 0}:${state?.run?.id ?? ""}:${phase?.id ?? ""}`}
        dailyGoal={state?.daily_goal ?? settings.pomodoro.daily_goal}
      />
      <PomodoroHistory onChanged={refresh} />
      <PomodoroStartDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        onStarted={(next) => setState(next)}
      />
    </PageContainer>
  );
}

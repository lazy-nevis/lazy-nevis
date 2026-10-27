import { useTranslation } from "react-i18next";
import {
  formatPomodoroClock,
  phaseGlowTone,
} from "@/components/features/pomodoro/pomodoroFormat";
import { GlowCard } from "@/components/ui/glow-card";
import { usePomodoro } from "@/hooks/usePomodoro";
import { useSettings } from "@/hooks/useSettings";

export function PomodoroWidget() {
  const { t } = useTranslation(undefined, { keyPrefix: "pomodoro" });
  const { settings } = useSettings();
  const { state } = usePomodoro();

  if (!settings.pomodoro.enabled || !state?.run) {
    return null;
  }

  const phaseKind = state.phase?.kind ?? null;

  return (
    <GlowCard
      tone={phaseGlowTone(phaseKind)}
      header={<p className="text-sm font-medium text-foreground">{t("widget.title")}</p>}
      footer={
        <p className="text-xs text-muted-foreground">
          {state.phase ? t(`phase.${state.phase.kind}`) : t("phase.idle")}
        </p>
      }
    >
      <p className="text-3xl font-semibold tabular-nums tracking-tight">
        {formatPomodoroClock(state.remaining_ms)}
      </p>
    </GlowCard>
  );
}

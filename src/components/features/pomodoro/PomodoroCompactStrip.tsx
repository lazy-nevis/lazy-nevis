import { useTranslation } from "react-i18next";
import {
  formatPomodoroClock,
  phaseIndicatorClass,
} from "@/components/features/pomodoro/pomodoroFormat";
import { Button } from "@/components/ui/button";
import { usePomodoro } from "@/hooks/usePomodoro";
import { pomodoroService } from "@/services/tauri";
import { usePomodoroStore } from "@/stores/pomodoroStore";
import { cn } from "@/utils/cn";

export function PomodoroCompactStrip() {
  const { t } = useTranslation(undefined, { keyPrefix: "pomodoro" });
  const { state } = usePomodoro();
  const setState = usePomodoroStore((s) => s.setState);

  if (!state?.run) {
    return null;
  }

  const phaseKind = state.phase?.kind ?? null;

  const togglePause = async () => {
    const next =
      state.state === "running"
        ? await pomodoroService.pause()
        : await pomodoroService.resume();
    setState(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2 py-1 text-sm text-muted-foreground">
      <span
        className={cn("size-2 shrink-0 rounded-full", phaseIndicatorClass(phaseKind))}
        aria-hidden
      />
      <span className="tabular-nums font-medium text-foreground">
        {formatPomodoroClock(state.remaining_ms)}
      </span>
      <Button type="button" size="xs" variant="ghost" onClick={() => void togglePause()}>
        {state.state === "running" ? t("controls.pause") : t("controls.resume")}
      </Button>
      <Button
        type="button"
        size="xs"
        variant="ghost"
        onClick={() => void pomodoroService.skipPhase().then(setState)}
      >
        {t("controls.skip")}
      </Button>
    </div>
  );
}

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

export function PomodoroTrayBlock() {
  const { t } = useTranslation(undefined, { keyPrefix: "pomodoro" });
  const { state } = usePomodoro();
  const setState = usePomodoroStore((s) => s.setState);

  if (!state?.run) {
    return null;
  }

  const phaseKind = state.phase?.kind ?? null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("size-2 shrink-0 rounded-full", phaseIndicatorClass(phaseKind))} />
          {t("tray.title")}
        </span>
        <span className="tabular-nums text-sm font-semibold text-foreground">
          {formatPomodoroClock(state.remaining_ms)}
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={state.state === "running" ? "secondary" : "brand"}
          className="flex-1"
          onClick={() =>
            void (state.state === "running"
              ? pomodoroService.pause()
              : pomodoroService.resume()
            ).then(setState)
          }
        >
          {state.state === "running" ? t("controls.pause") : t("controls.resume")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void pomodoroService.skipPhase().then(setState)}
        >
          {t("controls.skip")}
        </Button>
      </div>
    </div>
  );
}

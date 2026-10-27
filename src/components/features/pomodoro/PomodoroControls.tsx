import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { PomodoroRunState } from "@/types";

interface PomodoroControlsProps {
  runState: PomodoroRunState | null;
  hasRun: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onStop: () => void;
  onStartNext: () => void;
}

export function PomodoroControls({
  runState,
  hasRun,
  onStart,
  onPause,
  onResume,
  onSkip,
  onStop,
  onStartNext,
}: PomodoroControlsProps) {
  const { t } = useTranslation(undefined, { keyPrefix: "pomodoro" });

  if (!hasRun) {
    return (
      <Button type="button" variant="brand" size="lg" onClick={onStart}>
        {t("controls.start")}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {runState === "running" && (
        <Button type="button" variant="secondary" onClick={onPause}>
          {t("controls.pause")}
        </Button>
      )}
      {runState === "paused" && (
        <Button type="button" variant="brand" onClick={onResume}>
          {t("controls.resume")}
        </Button>
      )}
      {runState === "awaiting" && (
        <Button type="button" variant="brand" onClick={onStartNext}>
          {t("controls.start_next")}
        </Button>
      )}
      {runState !== "awaiting" && (
        <Button type="button" variant="outline" onClick={onSkip}>
          {t("controls.skip")}
        </Button>
      )}
      <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={onStop}>
        {t("controls.stop")}
      </Button>
    </div>
  );
}

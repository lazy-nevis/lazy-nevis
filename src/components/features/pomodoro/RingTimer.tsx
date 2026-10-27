import {
  formatPomodoroClock,
  phaseProgress,
  phaseRingStrokeClass,
} from "@/components/features/pomodoro/pomodoroFormat";
import type { PomodoroPhaseKind } from "@/types";
import { cn } from "@/utils/cn";

interface RingTimerProps {
  remainingMs: number;
  elapsedMs: number;
  plannedMs: number;
  phaseKind: PomodoroPhaseKind | null;
  phaseLabel: string;
}

export function RingTimer({
  remainingMs,
  elapsedMs,
  plannedMs,
  phaseKind,
  phaseLabel,
}: RingTimerProps) {
  const progress = phaseProgress(elapsedMs, plannedMs);
  const stroke = phaseRingStrokeClass(phaseKind);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-3" aria-live="polite">
      <div className="relative size-[140px]">
        <svg width="140" height="140" className="-rotate-90" aria-hidden>
          <circle
            cx="70"
            cy="70"
            r={radius}
            className="fill-none stroke-muted/40"
            strokeWidth="10"
          />
          <circle
            cx="70"
            cy="70"
            r={radius}
            className={cn("fill-none motion-safe:transition-[stroke-dashoffset]", stroke)}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {formatPomodoroClock(remainingMs)}
          </p>
        </div>
      </div>
      <p className="text-sm font-medium text-muted-foreground">{phaseLabel}</p>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function Stopwatch({
  onMinutesChange,
}: {
  onMinutesChange: (minutes: number) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (startedAt.current != null) {
        setElapsedMs(Date.now() - startedAt.current);
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [running]);

  // Keep the latest callback without making it an effect dependency: an inline callback from the
  // parent would otherwise re-fire this effect on every render and overwrite what the user typed.
  const onMinutesChangeRef = useRef(onMinutesChange);
  onMinutesChangeRef.current = onMinutesChange;
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    onMinutesChangeRef.current(elapsedMs / 60_000);
  }, [elapsedMs]);

  const minutes = (elapsedMs / 60_000).toFixed(1);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-sm tabular-nums">{minutes} min</span>
      <Button
        type="button"
        size="xs"
        variant="outline"
        onClick={() => {
          if (running) {
            setRunning(false);
          } else {
            startedAt.current = Date.now() - elapsedMs;
            setRunning(true);
          }
        }}
      >
        {running ? t("stopwatch_pause") : t("stopwatch_start")}
      </Button>
      <Button
        type="button"
        size="xs"
        variant="ghost"
        onClick={() => {
          setRunning(false);
          setElapsedMs(0);
          startedAt.current = null;
          onMinutesChange(0);
        }}
      >
        {t("stopwatch_reset")}
      </Button>
    </div>
  );
}

import { useEffect, useState } from "react";
import { endOfLocalDay, startOfLocalDay } from "@/utils/dates";

function msUntilNextMidnight(now: number): number {
  return endOfLocalDay(now) - now + 1;
}

/** Live clock for time-derived checklist UI (spec: checklist-organization). */
export function useNow(granularityMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, granularityMs);

    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    let midnightTimer = window.setTimeout(() => {
      tick();
      midnightTimer = window.setInterval(tick, granularityMs);
    }, msUntilNextMidnight(Date.now()));

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(midnightTimer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [granularityMs]);

  return now;
}

export function isTodayFilter(from: number | null, to: number | null, now: number): boolean {
  if (from === null || to === null) return false;
  return from === startOfLocalDay(now) && to === endOfLocalDay(now);
}

import { useCallback, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { habitService } from "@/services/tauri";
import { useHabitStore } from "@/stores/habitStore";
import { useNow } from "@/hooks/useNow";

export function useHabits() {
  const { today, all, setToday, setAll } = useHabitStore();
  const now = useNow();

  const refreshToday = useCallback(async () => {
    try {
      setToday(await habitService.getToday());
    } catch {
      /* backend unavailable */
    }
  }, [setToday]);

  const refreshAll = useCallback(async () => {
    try {
      setAll(await habitService.list(true));
    } catch {
      /* backend unavailable */
    }
  }, [setAll]);

  const refresh = useCallback(async () => {
    await Promise.all([refreshToday(), refreshAll()]);
  }, [refreshToday, refreshAll]);

  useEffect(() => {
    void refresh();
    let unlisten: (() => void) | undefined;
    void listen("habits:changed", () => {
      void refresh();
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [refresh]);

  useEffect(() => {
    void refreshToday();
  }, [now, refreshToday]);

  const pendingTodayCount =
    today == null
      ? 0
      : today.cards.filter((c) => c.progress.status !== "met").length;

  return {
    today,
    all,
    now,
    pendingTodayCount,
    refresh,
    refreshToday,
    refreshAll,
  };
}

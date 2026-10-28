import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { PomodoroState } from "@/types";
import { usePomodoroStore } from "@/stores/pomodoroStore";

export function usePomodoro() {
  const { state, hydrated, hydrate, setState } = usePomodoroStore();

  useEffect(() => {
    void hydrate();
    const unsubs: Array<() => void> = [];
    void listen<PomodoroState>("pomodoro:changed", (event) => {
      setState(event.payload);
    }).then((un) => unsubs.push(un));
    void listen<PomodoroState>("pomodoro:tick", (event) => {
      setState(event.payload);
    }).then((un) => unsubs.push(un));
    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [hydrate, setState]);

  return { state, hydrated };
}

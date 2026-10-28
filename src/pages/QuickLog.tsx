import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { HabitLogForm } from "@/components/features/habits/HabitLogForm";
import { habitIcon } from "@/components/features/habits/habitIcons";
import { habitService, settingsService } from "@/services/tauri";
import { useSettingsStore } from "@/stores/settingsStore";
import { useThemeSync } from "@/hooks/useThemeSync";
import type { Habit, HabitLogInput, QuickLogOpenPayload } from "@/types";
import { GlowCard } from "@/components/ui/glow-card";
import { toneStyle, toTone } from "@/utils/tones";

export function QuickLog() {
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });
  const [habit, setHabit] = useState<Habit | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  // Active habits for the picker shown when the window has no target habit.
  const [habits, setHabits] = useState<Habit[] | null>(null);
  useThemeSync();

  useEffect(() => {
    settingsService
      .get()
      .then((settings) => {
        useSettingsStore.getState().setSettings(settings);
        void i18n.changeLanguage(settings.general.language);
      })
      .catch(() => undefined);
  }, []);

  const loadHabits = useCallback(async () => {
    try {
      setHabits(await habitService.list(false));
    } catch {
      setHabits([]);
    }
  }, []);

  const openRequest = useCallback(async (request: QuickLogOpenPayload) => {
    setEventId(request.event_id);
    try {
      const detail = await habitService.getDetail(request.habit_id);
      setHabit(detail.habit);
    } catch {
      setHabit(null);
    }
  }, []);

  // `quicklog:open` can fire before this listener exists, so the backend also
  // keeps the request until the window drains it (spec: habit-tracking).
  const drainRequest = useCallback(
    async (fallback?: QuickLogOpenPayload) => {
      let request: QuickLogOpenPayload | null = null;
      try {
        request = await habitService.takeQuickLogRequest();
      } catch {
        /* backend unavailable */
      }
      const next = request ?? fallback;
      if (next) await openRequest(next);
    },
    [openRequest],
  );

  useEffect(() => {
    void loadHabits();
    void drainRequest();
    let unlistenOpen: (() => void) | undefined;
    let unlistenChanged: (() => void) | undefined;
    void listen<QuickLogOpenPayload>("quicklog:open", (event) => {
      void drainRequest(event.payload);
    }).then((fn) => {
      unlistenOpen = fn;
    });
    void listen("habits:changed", () => {
      void loadHabits();
    }).then((fn) => {
      unlistenChanged = fn;
    });
    const onFocus = () => void drainRequest();
    window.addEventListener("focus", onFocus);
    return () => {
      unlistenOpen?.();
      unlistenChanged?.();
      window.removeEventListener("focus", onFocus);
    };
  }, [drainRequest, loadHabits]);

  const hide = async () => {
    setHabit(null);
    setEventId(null);
    const win = await getCurrentWindow();
    await win.hide();
  };

  const onSubmit = async (input: HabitLogInput) => {
    if (!habit) return;
    await habitService.log(habit.id, {
      ...input,
      source: "quick_log",
      trigger_event_id: eventId,
    });
    await hide();
  };

  if (!habit) {
    if (habits == null) {
      return <div className="min-h-screen bg-background" />;
    }
    if (habits.length === 0) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <p className="text-sm text-muted-foreground">{t("empty_today")}</p>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-background p-3 pt-8 sm:p-4 sm:pt-8">
        <div className="mx-auto w-full max-w-md space-y-2">
          <p className="text-sm font-medium">{t("quick_log_pick")}</p>
          <ul className="space-y-1.5">
            {habits.map((item) => {
              const Icon = habitIcon(item.icon);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="tone-border flex w-full items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-left text-sm font-medium hover:bg-muted/60"
                    style={toneStyle(toTone(item.tone))}
                    onClick={() => setHabit(item)}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{item.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4">
      <div className="mx-auto w-full max-w-md">
        <GlowCard tone={toTone(habit.tone)} className="shadow-lg">
          <HabitLogForm
            habit={habit}
            source="quick_log"
            triggerEventId={eventId}
            onCancel={() => void hide()}
            onSubmit={onSubmit}
            compact
          />
        </GlowCard>
      </div>
    </div>
  );
}

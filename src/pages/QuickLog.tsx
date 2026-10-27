import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { HabitLogForm } from "@/components/features/habits/HabitLogForm";
import { habitService, settingsService } from "@/services/tauri";
import { useSettingsStore } from "@/stores/settingsStore";
import { useThemeSync } from "@/hooks/useThemeSync";
import type { Habit, HabitLogInput, QuickLogOpenPayload } from "@/types";
import { GlowCard } from "@/components/ui/glow-card";
import { toTone } from "@/utils/tones";

export function QuickLog() {
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });
  const [habit, setHabit] = useState<Habit | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
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

  const loadHabit = useCallback(async (habitId: string) => {
    const detail = await habitService.getDetail(habitId);
    setHabit(detail.habit);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<QuickLogOpenPayload>("quicklog:open", (event) => {
      setEventId(event.payload.event_id);
      void loadHabit(event.payload.habit_id);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [loadHabit]);

  const hide = async () => {
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-sm text-muted-foreground">{t("empty_today")}</p>
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

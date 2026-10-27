import { BellRing, CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChannelPicker } from "@/components/features/delivery/ChannelPicker";
import { SectionTitle, SettingRow } from "@/components/settings/setting-primitives";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useSettings } from "@/hooks/useSettings";
import { audioService } from "@/services/tauri";

export function DeliverySettingsTab() {
  const { t } = useTranslation(undefined, { keyPrefix: "delivery" });
  const { settings, saveSettings } = useSettings();
  const [builtinSounds, setBuiltinSounds] = useState<string[]>([]);

  useEffect(() => {
    void audioService.listBuiltin().then(setBuiltinSounds).catch(() => setBuiltinSounds([]));
  }, []);

  const updateDelivery = (partial: Partial<typeof settings.delivery>) => {
    void saveSettings({
      ...settings,
      delivery: { ...settings.delivery, ...partial },
    });
  };

  const weekValue = String(settings.general.week_start ?? 1);

  return (
    <div>
      <SectionTitle
        icon={<BellRing className="h-4 w-4" />}
        title={t("tab_title")}
        description={t("tab_description")}
      />

      <SettingRow icon={<CalendarDays className="h-4 w-4" />} label={t("week_start")}>
        <SegmentedControl
          aria-label={t("week_start")}
          value={weekValue}
          onChange={(value) =>
            void saveSettings({
              ...settings,
              general: { ...settings.general, week_start: Number(value) as 0 | 1 },
            })
          }
          options={[
            { value: "0", label: t("week_start_sunday") },
            { value: "1", label: t("week_start_monday") },
          ]}
        />
      </SettingRow>

      <div className="mt-4">
        <ChannelPicker
          label={t("types.reminder")}
          channels={settings.delivery.reminders}
          sound={settings.delivery.reminder_sound}
          onChannelsChange={(channels) => updateDelivery({ reminders: channels })}
          onSoundChange={(sound) => updateDelivery({ reminder_sound: sound })}
          testKind="reminder"
          builtinSounds={builtinSounds}
        />
        <ChannelPicker
          label={t("types.habit")}
          channels={settings.delivery.habits}
          sound={settings.delivery.habit_sound}
          onChannelsChange={(channels) => updateDelivery({ habits: channels })}
          onSoundChange={(sound) => updateDelivery({ habit_sound: sound })}
          testKind="habit"
          builtinSounds={builtinSounds}
        />
        <ChannelPicker
          label={t("types.pomodoro")}
          channels={settings.delivery.pomodoro}
          sound={settings.delivery.pomodoro_sound}
          onChannelsChange={(channels) => updateDelivery({ pomodoro: channels })}
          onSoundChange={(sound) => updateDelivery({ pomodoro_sound: sound })}
          testKind="pomodoro"
          builtinSounds={builtinSounds}
        />
      </div>
    </div>
  );
}

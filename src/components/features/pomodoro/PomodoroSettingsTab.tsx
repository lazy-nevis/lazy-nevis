import { Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectionTitle, SettingRow } from "@/components/settings/setting-primitives";
import { SectionCard } from "@/components/ui/section-card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/useSettings";
import type { PomodoroSettings } from "@/types";

export function PomodoroSettingsTab() {
  const { t } = useTranslation(undefined, { keyPrefix: "pomodoro" });
  const { settings, saveSettings } = useSettings();

  const update = (partial: Partial<PomodoroSettings>) => {
    void saveSettings({
      ...settings,
      pomodoro: { ...settings.pomodoro, ...partial },
    });
  };

  const minutes = (ms: number) => Math.round(ms / 60_000);

  return (
    <div className="space-y-4">
      <SectionTitle
        icon={<Timer className="h-4 w-4" />}
        title={t("settings.title")}
        description={t("settings.description")}
      />
      <SectionCard>
        <div className="space-y-0 -mx-1">
          <SettingRow label={t("settings.focus_minutes")}>
            <Input
              type="number"
              className="w-24"
              value={minutes(settings.pomodoro.focus_ms)}
              onChange={(e) =>
                update({ focus_ms: Math.max(1, Number(e.target.value)) * 60_000 })
              }
            />
          </SettingRow>
          <SettingRow label={t("settings.short_break_minutes")}>
            <Input
              type="number"
              className="w-24"
              value={minutes(settings.pomodoro.short_break_ms)}
              onChange={(e) =>
                update({ short_break_ms: Math.max(1, Number(e.target.value)) * 60_000 })
              }
            />
          </SettingRow>
          <SettingRow label={t("settings.long_break_minutes")}>
            <Input
              type="number"
              className="w-24"
              value={minutes(settings.pomodoro.long_break_ms)}
              onChange={(e) =>
                update({ long_break_ms: Math.max(1, Number(e.target.value)) * 60_000 })
              }
            />
          </SettingRow>
          <SettingRow label={t("settings.daily_goal")}>
            <Input
              type="number"
              className="w-24"
              value={settings.pomodoro.daily_goal}
              onChange={(e) => update({ daily_goal: Math.max(1, Number(e.target.value)) })}
            />
          </SettingRow>
          <SettingRow label={t("settings.link_focus_session")}>
            <Switch
              checked={settings.pomodoro.link_focus_session}
              onCheckedChange={(checked) => update({ link_focus_session: checked })}
            />
          </SettingRow>
        </div>
      </SectionCard>
    </div>
  );
}

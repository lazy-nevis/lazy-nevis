import { useTranslation } from "react-i18next";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { CalendarKind, CalendarSettings as CalendarSettingsType, CalendarView } from "@/types";
import { KindFilter } from "./KindFilter";

export interface CalendarSettingsPanelProps {
  settings: CalendarSettingsType;
  onChange: (next: CalendarSettingsType) => void;
}

export function CalendarSettingsPanel({ settings, onChange }: CalendarSettingsPanelProps) {
  const { t } = useTranslation(undefined, { keyPrefix: "calendar.settings" });

  return (
    <SectionCard title={t("title")} description={t("description")}>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium">{t("default_view")}</p>
          <SegmentedControl
            aria-label={t("default_view")}
            value={settings.default_view}
            onChange={(view) => onChange({ ...settings, default_view: view as CalendarView })}
            options={[
              { value: "month", label: t("views.month") },
              { value: "week", label: t("views.week") },
              { value: "day", label: t("views.day") },
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">{t("visible_kinds")}</p>
          <KindFilter
            visible={settings.visible_kinds}
            onChange={(kinds) =>
              onChange({ ...settings, visible_kinds: kinds as CalendarKind[] })
            }
          />
        </div>
      </div>
    </SectionCard>
  );
}

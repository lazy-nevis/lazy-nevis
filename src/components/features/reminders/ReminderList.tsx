import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import type { Reminder } from "@/types";
import { describeSchedule, formatRelativeNext } from "@/utils/schedule";
import { toneStyle, toTone } from "@/utils/tones";

interface ReminderListProps {
  items: Reminder[];
  weekStart: 0 | 1;
  locale: string;
  onSelect: (item: Reminder) => void;
  onToggleActive: (item: Reminder, active: boolean) => void;
}

export function ReminderList({
  items,
  weekStart,
  locale,
  onSelect,
  onToggleActive,
}: ReminderListProps) {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: "reminders" });

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title={t("list.empty")}
        className="border-solid bg-card"
      />
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {items.map((item) => {
        const tone = toTone(item.tone);
        const scheduleSummary =
          item.schedules[0]
            ? describeSchedule(
                item.schedules[0].rule,
                (key, options) => i18n.t(key, options),
                locale || i18n.language,
                weekStart,
              )
            : i18n.t("schedule.summary.unset");
        return (
          <li key={item.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
            <button
              type="button"
              className="mt-1.5 h-3 w-3 shrink-0 rounded-full tone-dot"
              style={toneStyle(tone)}
              aria-hidden
              onClick={() => onSelect(item)}
            />
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => onSelect(item)}
            >
              <p className="font-medium text-foreground">{item.title}</p>
              <p className="text-sm text-muted-foreground">{scheduleSummary}</p>
              <p className="text-xs text-muted-foreground">
                {formatRelativeNext(item.next_occurrence, t, locale || i18n.language)}
              </p>
            </button>
            <Switch
              checked={item.active}
              aria-label={item.active ? t("list.active") : t("list.paused")}
              onCheckedChange={(checked) => onToggleActive(item, checked)}
            />
          </li>
        );
      })}
    </ul>
  );
}

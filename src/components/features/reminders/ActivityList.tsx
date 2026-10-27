import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { TriggerEvent } from "@/types";

interface ActivityListProps {
  events: TriggerEvent[];
  locale: string;
  onDone: (event: TriggerEvent) => void;
  onSnooze: (event: TriggerEvent) => void;
}

export function ActivityList({ events, locale, onDone, onSnooze }: ActivityListProps) {
  const { t } = useTranslation(undefined, { keyPrefix: "reminders" });

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("activity.empty")}</p>;
  }

  return (
    <ul className="space-y-2">
      {events.map((event) => (
        <li
          key={event.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
        >
          <div>
            <p className="text-sm font-medium">{event.reminder_title ?? event.owner_id}</p>
            <p className="text-xs text-muted-foreground">
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(event.scheduled_for))}
              {" · "}
              {event.status}
              {event.late ? ` · ${t("overlay.late")}` : ""}
            </p>
          </div>
          {event.status === "delivered" && (
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => onDone(event)}>
                {t("activity.done")}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onSnooze(event)}>
                {t("activity.snooze")}
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

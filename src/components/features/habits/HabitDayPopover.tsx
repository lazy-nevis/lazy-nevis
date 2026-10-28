import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { HabitLog } from "@/types";

export function HabitDayPopover({
  date,
  logs,
  onClose,
  onEditLog,
}: {
  date: string;
  logs: HabitLog[];
  onClose: () => void;
  onEditLog: (log: HabitLog) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });

  return (
    <div
      className="absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-border bg-popover p-3 shadow-lg"
      role="dialog"
      aria-label={t("day_popover_title", { date })}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t("day_popover_title", { date })}</p>
        <Button type="button" size="xs" variant="ghost" onClick={onClose}>
          {t("cancel")}
        </Button>
      </div>
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("day_popover_empty")}</p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {logs.map((log) => (
            <li key={log.id}>
              <button
                type="button"
                className="w-full rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
                onClick={() => onEditLog(log)}
              >
                {new Date(log.logged_at).toLocaleTimeString()} — {log.source}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

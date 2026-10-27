import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScheduleInput, ScheduleRule } from "@/types";
import { describeSchedule } from "@/utils/schedule";

interface ScheduleEditorProps {
  value: ScheduleInput;
  weekStart: 0 | 1;
  locale: string;
  onChange: (value: ScheduleInput) => void;
  onRemove?: () => void;
}

const KINDS: ScheduleRule["kind"][] = ["once", "daily", "interval", "monthly"];

export function ScheduleEditor({
  value,
  weekStart,
  locale,
  onChange,
  onRemove,
}: ScheduleEditorProps) {
  const { t, i18n } = useTranslation();

  const setRule = (rule: ScheduleRule) => onChange({ ...value, rule });

  const summary = describeSchedule(value.rule, t, locale || i18n.language, weekStart);

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{summary}</p>
        {onRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            {t("reminders.editor.cancel")}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {KINDS.map((kind) => (
          <Button
            key={kind}
            type="button"
            size="sm"
            variant={value.rule.kind === kind ? "default" : "outline"}
            onClick={() =>
              setRule(
                kind === "once"
                  ? { kind, at: "" }
                  : kind === "daily"
                    ? { kind, times: ["09:00"], weekdays: [] }
                    : kind === "interval"
                      ? {
                          kind,
                          every_minutes: 60,
                          window_start: "09:00",
                          window_end: "18:00",
                          weekdays: [],
                        }
                      : { kind, days: [1], times: ["09:00"] },
              )
            }
          >
            {t(`schedule.kinds.${kind}`)}
          </Button>
        ))}
      </div>
      {value.rule.kind === "once" && (
        <div>
          <label className="text-sm font-medium">{t("schedule.fields.at")}</label>
          <Input
            value={value.rule.at}
            onChange={(event) => setRule({ kind: "once", at: event.target.value })}
            placeholder={t("schedule.fields.at")}
          />
        </div>
      )}
      {value.rule.kind === "daily" &&
        (() => {
          const rule = value.rule;
          return (
            <div>
              <label className="text-sm font-medium">{t("schedule.fields.times")}</label>
              <Input
                value={rule.times.join(", ")}
                onChange={(event) =>
                  setRule({
                    kind: "daily",
                    times: event.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    weekdays: rule.weekdays,
                  })
                }
              />
            </div>
          );
        })()}
      {value.rule.kind === "interval" &&
        (() => {
          const rule = value.rule;
          return (
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">{t("schedule.fields.every_minutes")}</label>
                <Input
                  type="number"
                  value={rule.every_minutes}
                  onChange={(event) =>
                    setRule({
                      kind: "interval",
                      every_minutes: Number(event.target.value),
                      window_start: rule.window_start,
                      window_end: rule.window_end,
                      weekdays: rule.weekdays,
                    })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("schedule.fields.window_start")}</label>
                <Input
                  value={rule.window_start}
                  onChange={(event) =>
                    setRule({
                      kind: "interval",
                      every_minutes: rule.every_minutes,
                      window_start: event.target.value,
                      window_end: rule.window_end,
                      weekdays: rule.weekdays,
                    })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("schedule.fields.window_end")}</label>
                <Input
                  value={rule.window_end}
                  onChange={(event) =>
                    setRule({
                      kind: "interval",
                      every_minutes: rule.every_minutes,
                      window_start: rule.window_start,
                      window_end: event.target.value,
                      weekdays: rule.weekdays,
                    })
                  }
                />
              </div>
            </div>
          );
        })()}
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">{t("schedule.fields.starts_on")}</label>
          <Input
            value={value.starts_on ?? ""}
            onChange={(event) =>
              onChange({ ...value, starts_on: event.target.value || null })
            }
          />
        </div>
        <div>
          <label className="text-sm font-medium">{t("schedule.fields.ends_on")}</label>
          <Input
            value={value.ends_on ?? ""}
            onChange={(event) =>
              onChange({ ...value, ends_on: event.target.value || null })
            }
          />
        </div>
      </div>
    </div>
  );
}

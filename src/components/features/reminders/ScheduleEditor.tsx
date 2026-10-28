import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DatePicker, DateTimePicker, TimePicker, toDateKey } from "@/components/ui/date-picker";
import { Tooltip } from "@/components/ui/tooltip";
import type { ScheduleInput, ScheduleRule } from "@/types";
import { describeSchedule } from "@/utils/schedule";
import { cn } from "@/utils/cn";

interface ScheduleEditorProps {
  value: ScheduleInput;
  weekStart: 0 | 1;
  locale: string;
  onChange: (value: ScheduleInput) => void;
  onRemove?: () => void;
}

const KINDS: ScheduleRule["kind"][] = ["once", "daily", "interval", "monthly"];

function defaultRule(kind: ScheduleRule["kind"]): ScheduleRule {
  switch (kind) {
    case "once": {
      const next = new Date(Date.now() + 3_600_000);
      return { kind, at: `${toDateKey(next)}T${String(next.getHours()).padStart(2, "0")}:00` };
    }
    case "daily":
      return { kind, times: ["09:00"], weekdays: [] };
    case "interval":
      return { kind, every_minutes: 60, window_start: "09:00", window_end: "18:00", weekdays: [] };
    case "monthly":
      return { kind, days: [1], times: ["09:00"] };
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Toggle chips for weekdays (0=Sun…6=Sat); empty selection means every day. */
function WeekdayPicker({
  value,
  weekStart,
  onChange,
}: {
  value: number[];
  weekStart: 0 | 1;
  onChange: (value: number[]) => void;
}) {
  const { t } = useTranslation();
  const order = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);
  const toggle = (day: number) =>
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort());
  return (
    <div className="flex flex-wrap items-center gap-1">
      {order.map((day) => {
        const on = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(day)}
            className={cn(
              "h-8 min-w-10 rounded-md border px-2 text-xs font-medium transition-colors",
              on
                ? "border-brand bg-brand text-brand-foreground"
                : "border-input text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {t(`schedule.weekdays.short.${day}`)}
          </button>
        );
      })}
      {value.length === 0 && (
        <span className="ml-1 text-xs text-muted-foreground">{t("schedule.weekdays.every_day")}</span>
      )}
    </div>
  );
}

/** One TimePicker per time, with add/remove. */
function TimesEditor({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const { t } = useTranslation();
  const update = (index: number, time: string) =>
    onChange([...new Set(value.map((v, i) => (i === index ? time : v)))].sort());
  return (
    <div className="flex flex-wrap items-center gap-2">
      {value.map((time, index) => (
        <div key={`${time}-${index}`} className="flex items-center">
          <TimePicker value={time} onChange={(next) => update(index, next)} />
          {value.length > 1 && (
            <Tooltip label={t("schedule.actions.remove_time")}>
              <button
                type="button"
                aria-label={t("schedule.actions.remove_time")}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="ml-0.5 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          const last = value[value.length - 1] ?? "08:00";
          const hour = (Number(last.slice(0, 2)) + 1) % 24;
          onChange([...new Set([...value, `${String(hour).padStart(2, "0")}:${last.slice(3, 5) || "00"}`])].sort());
        }}
        className="inline-flex h-9 items-center gap-1 rounded-md border border-dashed border-input px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("schedule.actions.add_time")}
      </button>
    </div>
  );
}

/** 1–31 grid for monthly rules. */
function MonthDayPicker({ value, onChange }: { value: number[]; onChange: (value: number[]) => void }) {
  return (
    <div className="grid w-full max-w-[300px] grid-cols-7 gap-1">
      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
        const on = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            onClick={() => {
              const next = on ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b);
              if (next.length > 0) onChange(next);
            }}
            className={cn(
              "h-8 rounded-md text-xs tabular-nums transition-colors",
              on ? "bg-brand font-semibold text-brand-foreground" : "hover:bg-accent",
            )}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}

export function ScheduleEditor({
  value,
  weekStart,
  locale,
  onChange,
  onRemove,
}: ScheduleEditorProps) {
  const { t, i18n } = useTranslation();
  const rule = value.rule;
  const setRule = (next: ScheduleRule) => onChange({ ...value, rule: next });
  const summary = describeSchedule(rule, t, locale || i18n.language, weekStart);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="inline-flex rounded-lg bg-muted p-0.5" role="tablist">
          {KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={rule.kind === kind}
              onClick={() => rule.kind !== kind && setRule(defaultRule(kind))}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                rule.kind === kind
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`schedule.kinds.${kind}`)}
            </button>
          ))}
        </div>
        {onRemove && (
          <Tooltip label={t("schedule.actions.remove")}>
            <button
              type="button"
              aria-label={t("schedule.actions.remove")}
              onClick={onRemove}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
      </div>

      {rule.kind === "once" && (
        <Field label={t("schedule.fields.at")}>
          <DateTimePicker
            value={rule.at}
            weekStart={weekStart}
            onChange={(at) => setRule({ kind: "once", at })}
          />
        </Field>
      )}

      {rule.kind === "daily" && (
        <>
          <Field label={t("schedule.fields.times")}>
            <TimesEditor value={rule.times} onChange={(times) => setRule({ ...rule, times })} />
          </Field>
          <Field label={t("schedule.fields.weekdays")}>
            <WeekdayPicker
              value={rule.weekdays}
              weekStart={weekStart}
              onChange={(weekdays) => setRule({ ...rule, weekdays })}
            />
          </Field>
        </>
      )}

      {rule.kind === "interval" && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t("schedule.fields.every_minutes")}>
              <Input
                type="number"
                min={5}
                step={5}
                className="w-24"
                value={rule.every_minutes}
                onChange={(event) =>
                  setRule({ ...rule, every_minutes: Math.max(1, Number(event.target.value) || 1) })
                }
              />
            </Field>
            <Field label={t("schedule.fields.window_start")}>
              <TimePicker value={rule.window_start} onChange={(window_start) => setRule({ ...rule, window_start })} />
            </Field>
            <Field label={t("schedule.fields.window_end")}>
              <TimePicker value={rule.window_end} onChange={(window_end) => setRule({ ...rule, window_end })} />
            </Field>
          </div>
          <Field label={t("schedule.fields.weekdays")}>
            <WeekdayPicker
              value={rule.weekdays}
              weekStart={weekStart}
              onChange={(weekdays) => setRule({ ...rule, weekdays })}
            />
          </Field>
        </>
      )}

      {rule.kind === "monthly" && (
        <>
          <Field label={t("schedule.fields.month_days")}>
            <MonthDayPicker value={rule.days} onChange={(days) => setRule({ ...rule, days })} />
          </Field>
          <Field label={t("schedule.fields.times")}>
            <TimesEditor value={rule.times} onChange={(times) => setRule({ ...rule, times })} />
          </Field>
        </>
      )}

      {rule.kind !== "once" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("schedule.fields.starts_on")}>
            <DatePicker
              value={value.starts_on ?? null}
              weekStart={weekStart}
              placeholder={t("schedule.fields.no_start")}
              onChange={(starts_on) => onChange({ ...value, starts_on })}
            />
          </Field>
          <Field label={t("schedule.fields.ends_on")}>
            <DatePicker
              value={value.ends_on ?? null}
              weekStart={weekStart}
              placeholder={t("schedule.fields.no_end")}
              onChange={(ends_on) => onChange({ ...value, ends_on })}
            />
          </Field>
        </div>
      )}

      <p className="border-t border-border pt-2 text-xs text-muted-foreground">{summary}</p>
    </div>
  );
}

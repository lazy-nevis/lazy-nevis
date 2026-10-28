import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { Info, Plus, Trash2 } from "lucide-react";
import { DeliveryOverrideSection } from "@/components/features/delivery/DeliveryOverrideSection";
import { HabitIconPicker } from "@/components/features/habits/HabitIconPicker";
import { ScheduleEditor } from "@/components/features/reminders/ScheduleEditor";
import type { AlertChannels, Habit, HabitInput, HabitTargetInput, ScheduleInput } from "@/types";
import { TONES, toTone } from "@/utils/tones";
import { emptyRule } from "@/utils/schedule";
import { cn } from "@/utils/cn";
import { defaultUnitForMetric, metricLabel } from "@/components/features/habits/habitFormat";

const METRICS = ["check", "count", "volume", "mass", "distance", "duration"] as const;

export function HabitEditorDialog({
  open,
  habit,
  weekStart,
  locale,
  defaultChannels,
  defaultSound,
  builtinSounds,
  onClose,
  onSave,
}: {
  open: boolean;
  habit: Habit | null;
  weekStart: 0 | 1;
  locale: string;
  defaultChannels: AlertChannels;
  defaultSound: string;
  builtinSounds: string[];
  onClose: () => void;
  onSave: (input: HabitInput) => Promise<void>;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState("emerald");
  const [icon, setIcon] = useState("target");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [active, setActive] = useState(true);
  const [skipWhenMet, setSkipWhenMet] = useState(true);
  const [useCustomDelivery, setUseCustomDelivery] = useState(false);
  const [channels, setChannels] = useState<AlertChannels>(defaultChannels);
  const [sound, setSound] = useState(defaultSound);
  const [targets, setTargets] = useState<HabitTargetInput[]>([
    { metric: "check", unit: "", target_value: 1 },
  ]);
  const [schedules, setSchedules] = useState<ScheduleInput[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (habit) {
      setName(habit.name);
      setDescription(habit.description ?? "");
      setTone(habit.tone);
      setIcon(habit.icon);
      setPeriod(habit.period);
      setActive(habit.active);
      setSkipWhenMet(habit.skip_reminders_when_met);
      setUseCustomDelivery(habit.channels != null);
      setChannels(habit.channels ?? defaultChannels);
      setSound(habit.sound ?? defaultSound);
      setTargets(
        habit.targets
          .filter((t) => t.archived_at == null)
          .map((t) => ({
            id: t.id,
            metric: t.metric,
            unit: t.unit,
            target_value: t.target_value,
          })),
      );
      setSchedules(
        habit.schedules.map((s) => ({
          id: s.id,
          rule: s.rule,
          active: s.active,
          starts_on: s.starts_on,
          ends_on: s.ends_on,
        })),
      );
    } else {
      setName("");
      setDescription("");
      setTone("emerald");
      setIcon("target");
      setPeriod("daily");
      setActive(true);
      setSkipWhenMet(true);
      setUseCustomDelivery(false);
      setChannels(defaultChannels);
      setSound(defaultSound);
      setTargets([{ metric: "check", unit: "", target_value: 1 }]);
      setSchedules([]);
    }
    setError(null);
  }, [open, habit, defaultChannels, defaultSound]);

  const handleSave = async () => {
    if (targets.length < 1 || targets.length > 5) {
      setError(t("validation_targets"));
      return;
    }
    const input: HabitInput = {
      name,
      description: description.trim() ? description : null,
      tone: toTone(tone),
      icon,
      period,
      active,
      skip_reminders_when_met: skipWhenMet,
      channels: useCustomDelivery ? channels : null,
      sound: useCustomDelivery ? sound : null,
      targets,
      schedules,
    };
    await onSave(input);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{habit ? t("editor_title_edit") : t("editor_title_create")}</DialogTitle>
      </DialogHeader>
      <ScrollArea viewportClassName="max-h-[72vh]" contentClassName="space-y-4 px-0.5">
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("field_name")}</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("field_description")}</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-sm font-medium">{t("field_period")}</label>
            <Select
              className="mt-1 w-full"
              value={period}
              onChange={(e) => setPeriod(e.target.value as typeof period)}
            >
              <option value="daily">{t("period_daily")}</option>
              <option value="weekly">{t("period_weekly")}</option>
              <option value="monthly">{t("period_monthly")}</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">{t("field_tone")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {TONES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform",
                    toTone(tone) === value ? "border-foreground scale-105" : "border-transparent",
                  )}
                  style={{ background: `hsl(var(--tone-${value}))` }}
                  onClick={() => setTone(value)}
                  aria-label={value}
                  aria-pressed={toTone(tone) === value}
                />
              ))}
            </div>
          </div>
          <div>
            <span className="text-sm font-medium">{t("field_icon")}</span>
            <div className="mt-1">
              <HabitIconPicker value={icon} tone={tone} onChange={setIcon} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">{t("field_skip_when_met")}</span>
          <Switch checked={skipWhenMet} onCheckedChange={setSkipWhenMet} />
        </div>
        <section className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold">{t("targets_title")}</h3>
              <Tooltip label={t("targets_help")} side="right">
                <Info className="h-3.5 w-3.5 text-muted-foreground" aria-label={t("targets_help")} />
              </Tooltip>
              <span className="text-xs tabular-nums text-muted-foreground">{targets.length}/5</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={targets.length >= 5}
              onClick={() =>
                setTargets((prev) => [
                  ...prev,
                  { metric: "count", unit: t("units.times"), target_value: 1 },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t("add_target")}
            </Button>
          </div>
          <div className="hidden grid-cols-[1.2fr_1fr_0.8fr_auto] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
            <Tooltip label={t("target_metric_help")}><span>{t("target_metric")}</span></Tooltip>
            <Tooltip label={t("target_unit_help")}><span>{t("target_unit")}</span></Tooltip>
            <Tooltip label={t("target_value_help")}><span>{t("target_value")}</span></Tooltip>
            <span className="w-8" />
          </div>
          {targets.map((target, index) => (
            <div
              key={index}
              className="grid items-center gap-2 rounded-lg border border-border bg-background p-2 sm:grid-cols-[1.2fr_1fr_0.8fr_auto]"
            >
              <Select
                aria-label={t("target_metric")}
                className="w-full"
                value={target.metric}
                onChange={(e) => {
                  const metric = e.target.value;
                  setTargets((prev) =>
                    prev.map((row, i) =>
                      i === index
                        ? {
                            ...row,
                            metric,
                            unit: defaultUnitForMetric(metric, t),
                            target_value: metric === "check" ? 1 : row.target_value,
                          }
                        : row,
                    ),
                  );
                }}
              >
                {METRICS.map((metric) => (
                  <option key={metric} value={metric}>{metricLabel(metric, t)}</option>
                ))}
              </Select>
              {target.metric === "check" ? (
                <p className="text-xs text-muted-foreground sm:col-span-2">{t("target_check_hint")}</p>
              ) : (
                <>
                  <Input
                    aria-label={t("target_unit")}
                    value={target.unit}
                    onChange={(e) =>
                      setTargets((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, unit: e.target.value } : row)),
                      )
                    }
                    placeholder={t("target_unit")}
                  />
                  <Input
                    aria-label={t("target_value")}
                    type="number"
                    min={0}
                    step="any"
                    value={target.target_value}
                    onChange={(e) =>
                      setTargets((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, target_value: Number(e.target.value) } : row,
                        ),
                      )
                    }
                  />
                </>
              )}
              <Tooltip label={t("remove_target")}>
                <button
                  type="button"
                  aria-label={t("remove_target")}
                  disabled={targets.length <= 1}
                  onClick={() => setTargets((prev) => prev.filter((_, i) => i !== index))}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{t("targets_change_note")}</p>
        </section>
        <section className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
          <h3 className="text-sm font-semibold">{t("reminders_title")}</h3>
          {(schedules.length
            ? schedules
            : [{ rule: emptyRule("daily"), active: true, starts_on: null, ends_on: null }]
          ).map((schedule, index) => (
            <ScheduleEditor
              key={index}
              value={schedule}
              weekStart={weekStart}
              locale={locale}
              onChange={(next) =>
                setSchedules((prev) => {
                  const base = prev.length ? [...prev] : [schedule];
                  base[index] = next;
                  return base;
                })
              }
              onRemove={
                schedules.length > 1
                  ? () => setSchedules((prev) => prev.filter((_, i) => i !== index))
                  : undefined
              }
            />
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() =>
              setSchedules((prev) => [
                ...(prev.length ? prev : [{ rule: emptyRule("daily"), active: true, starts_on: null, ends_on: null }]),
                { rule: emptyRule("daily"), active: true, starts_on: null, ends_on: null },
              ])
            }
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t("add_schedule")}
          </Button>
        </section>
        <DeliveryOverrideSection
          custom={useCustomDelivery}
          onCustomChange={setUseCustomDelivery}
          channels={channels}
          sound={sound}
          onChannelsChange={setChannels}
          onSoundChange={setSound}
          testKind="habit"
          builtinSounds={builtinSounds}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </ScrollArea>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{t("cancel")}</Button>
        <Button type="button" onClick={() => void handleSave()}>{t("save")}</Button>
      </DialogFooter>
    </Dialog>
  );
}

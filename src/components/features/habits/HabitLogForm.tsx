import { useEffect, useMemo, useState } from "react";
import { DateTimePicker } from "@/components/ui/date-picker";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Stopwatch } from "@/components/features/habits/Stopwatch";
import { formatProgressLine } from "@/components/features/habits/habitFormat";
import type { Habit, HabitLogInput, HabitLogSource, HabitTargetProgress } from "@/types";
import { toneStyle, toTone } from "@/utils/tones";
import { cn } from "@/utils/cn";

function toLocalDatetimeInput(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const QUICK_ADD: Record<string, number[]> = {
  volume: [250, 500, 1000],
  duration: [5, 10, 15],
  count: [1, 5, 10],
};

export function HabitLogForm({
  habit,
  progress,
  source,
  triggerEventId,
  onSubmit,
  onCancel,
  initialLoggedAt,
  initialNote,
  initialValues,
  compact = false,
}: {
  habit: Habit;
  progress?: HabitTargetProgress[];
  source: HabitLogSource;
  triggerEventId?: string | null;
  onSubmit: (input: HabitLogInput) => Promise<void>;
  onCancel?: () => void;
  initialLoggedAt?: number;
  initialNote?: string | null;
  initialValues?: { target_id: string; value: number }[];
  compact?: boolean;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });
  const targets = useMemo(
    () => habit.targets.filter((target) => target.archived_at == null),
    [habit.targets],
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState(initialNote ?? "");
  const [loggedAt, setLoggedAt] = useState(() =>
    toLocalDatetimeInput(initialLoggedAt ?? Date.now()),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const target of targets) {
      const preset = initialValues?.find((v) => v.target_id === target.id);
      if (preset != null) {
        initial[target.id] = String(preset.value);
      } else {
        initial[target.id] = target.metric === "check" ? "1" : "";
      }
    }
    setValues(initial);
    if (initialNote != null) setNote(initialNote);
    if (initialLoggedAt != null) {
      setLoggedAt(toLocalDatetimeInput(initialLoggedAt));
    }
  }, [targets, initialLoggedAt, initialNote, initialValues]);

  const hint = progress ? formatProgressLine(progress) : "";

  const handleSave = async () => {
    const parsed = targets
      .map((target) => {
        const raw = values[target.id] ?? "";
        const value = target.metric === "check" ? 1 : Number.parseFloat(raw);
        if (!Number.isFinite(value) || value <= 0) return null;
        return { target_id: target.id, value };
      })
      .filter((v): v is { target_id: string; value: number } => v != null);
    if (parsed.length === 0) return;
    const at = new Date(loggedAt).getTime();
    if (!Number.isFinite(at) || at > Date.now()) return;
    setBusy(true);
    try {
      await onSubmit({
        values: parsed,
        note: note.trim() ? note.trim() : null,
        logged_at: at,
        source,
        trigger_event_id: triggerEventId ?? null,
      });
    } finally {
      setBusy(false);
    }
  };

  const tone = toTone(habit.tone);

  return (
    <div className={cn("space-y-4", compact ? "p-4" : "p-4")}>
      <div className="space-y-1">
        <p className="text-lg font-semibold tone-text" style={toneStyle(tone)}>
          {habit.name}
        </p>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        {compact && <p className="text-xs text-muted-foreground">{t("quick_log_hint")}</p>}
      </div>
      {targets.map((target) => (
        <div key={target.id} className="space-y-2">
          <label className="text-sm font-medium">
            {t(`metrics.${target.metric}`, { defaultValue: target.metric })} ({target.unit})
          </label>
          {target.metric === "check" ? (
            <p className="text-sm text-muted-foreground">{t("mark_done")}</p>
          ) : (
            <>
              <Input
                type="number"
                min={0}
                step="any"
                value={values[target.id] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [target.id]: e.target.value }))
                }
              />
              {QUICK_ADD[target.metric]?.length ? (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground">{t("quick_add")}:</span>
                  {QUICK_ADD[target.metric].map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        const current = Number.parseFloat(values[target.id] ?? "0") || 0;
                        setValues((prev) => ({
                          ...prev,
                          [target.id]: String(current + amount),
                        }));
                      }}
                    >
                      +{amount}
                    </Button>
                  ))}
                </div>
              ) : null}
              {target.metric === "duration" && (
                <Stopwatch
                  onMinutesChange={(minutes) =>
                    setValues((prev) => ({
                      ...prev,
                      [target.id]: minutes > 0 ? minutes.toFixed(1) : "",
                    }))
                  }
                />
              )}
            </>
          )}
        </div>
      ))}
      <div className="space-y-1">
        <label className="text-sm font-medium">{t("log_note")}</label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="space-y-1">
        <span className="text-sm font-medium">{t("log_when")}</span>
        <DateTimePicker value={loggedAt} onChange={setLoggedAt} />
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
        )}
        <Button type="button" variant="brand" disabled={busy} onClick={() => void handleSave()}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

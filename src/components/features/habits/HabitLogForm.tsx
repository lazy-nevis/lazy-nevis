import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { DateTimePicker } from "@/components/ui/date-picker";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Stopwatch } from "@/components/features/habits/Stopwatch";
import { ValueStepper } from "@/components/features/habits/ValueStepper";
import { formatProgressLine } from "@/components/features/habits/habitFormat";
import type { Habit, HabitLogInput, HabitLogSource, HabitTargetProgress } from "@/types";
import { toneStyle, toTone } from "@/utils/tones";
import { cn } from "@/utils/cn";

type InitialValues = { target_id: string; value: number }[];

function toLocalDatetimeInput(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildInitialValues(
  targets: Habit["targets"],
  initialValues: InitialValues | undefined,
): Record<string, number> {
  const initial: Record<string, number> = {};
  for (const target of targets) {
    const preset = initialValues?.find((v) => v.target_id === target.id);
    initial[target.id] = preset?.value ?? (target.metric === "check" ? 1 : 0);
  }
  return initial;
}

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
  initialValues?: InitialValues;
  compact?: boolean;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });
  const targets = useMemo(
    () => habit.targets.filter((target) => target.archived_at == null),
    [habit.targets],
  );
  const [values, setValues] = useState<Record<string, number>>(() =>
    buildInitialValues(targets, initialValues),
  );
  const [note, setNote] = useState(initialNote ?? "");
  const [loggedAt, setLoggedAt] = useState(() =>
    toLocalDatetimeInput(initialLoggedAt ?? Date.now()),
  );
  const [moreOpen, setMoreOpen] = useState(initialNote != null || initialLoggedAt != null);
  const [busy, setBusy] = useState(false);

  // Re-seed only when the *content* of the seed changes (another habit or another log being
  // edited). Depending on array identity would wipe what the user typed on every parent refresh,
  // because the habit list is re-fetched (new objects) on timers and `habits:changed` events.
  const seedKey = JSON.stringify([
    habit.id,
    initialLoggedAt ?? null,
    initialNote ?? null,
    initialValues ?? null,
  ]);
  const seededKey = useRef(seedKey);
  useEffect(() => {
    if (seededKey.current === seedKey) return;
    seededKey.current = seedKey;
    setValues(buildInitialValues(targets, initialValues));
    setNote(initialNote ?? "");
    setLoggedAt(toLocalDatetimeInput(initialLoggedAt ?? Date.now()));
    setMoreOpen(initialNote != null || initialLoggedAt != null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on seedKey on purpose
  }, [seedKey]);

  const setTargetValue = useCallback((id: string, value: number) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  const hint = progress ? formatProgressLine(progress) : "";
  const hasValue = targets.some((target) =>
    target.metric === "check" ? true : (values[target.id] ?? 0) > 0,
  );

  const handleSave = async (overrides?: Record<string, number>) => {
    const parsed = targets
      .map((target) => {
        const value =
          target.metric === "check" ? 1 : (overrides?.[target.id] ?? values[target.id] ?? 0);
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
    <div
      className={cn("space-y-4", compact ? "p-4" : "p-4")}
      onKeyDown={(e) => {
        // Enter in the note field (or anywhere that is not a button) saves.
        if (e.key !== "Enter" || e.defaultPrevented || busy) return;
        const el = e.target as HTMLElement;
        if (el.tagName === "BUTTON" || el.tagName === "TEXTAREA") return;
        e.preventDefault();
        void handleSave();
      }}
    >
      <div className="space-y-1">
        <p className="text-lg font-semibold tone-text" style={toneStyle(tone)}>
          {habit.name}
        </p>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        {compact && <p className="text-xs text-muted-foreground">{t("quick_log_hint")}</p>}
      </div>
      {targets.map((target) => {
        const metricLabel = t(`metrics.${target.metric}`, { defaultValue: target.metric });
        return (
          <div key={target.id} className="space-y-2">
            {target.metric === "check" ? (
              <>
                <span className="text-sm font-medium">
                  {metricLabel} {target.unit ? `(${target.unit})` : ""}
                </span>
                <p className="text-sm text-muted-foreground">{t("mark_done")}</p>
              </>
            ) : (
              <>
                <span className="block text-center text-sm font-medium">{metricLabel}</span>
                <ValueStepper
                  value={values[target.id] ?? 0}
                  onChange={(v) => setTargetValue(target.id, v)}
                  onEnter={(v) => void handleSave({ [target.id]: v })}
                  metric={target.metric}
                  unit={target.unit}
                  metricLabel={metricLabel}
                />
                {target.metric === "duration" && (
                  <div className="flex justify-center">
                    <Stopwatch
                      onMinutesChange={(minutes) =>
                        setTargetValue(target.id, Math.round(minutes * 10) / 10)
                      }
                    />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      <div>
        <button
          type="button"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", moreOpen && "rotate-180")}
            aria-hidden
          />
          {t("log_more_options")}
        </button>
        <AnimatePresence initial={false}>
          {moreOpen && (
            <motion.div
              key="more"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="space-y-3 pt-3">
                <div className="space-y-1">
                  <label htmlFor={`log-note-${habit.id}`} className="text-sm font-medium">
                    {t("log_note")}
                  </label>
                  <Input
                    id={`log-note-${habit.id}`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-sm font-medium">{t("log_when")}</span>
                  <DateTimePicker value={loggedAt} onChange={setLoggedAt} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
        )}
        <Button
          type="button"
          variant="brand"
          disabled={busy || !hasValue}
          onClick={() => void handleSave()}
        >
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

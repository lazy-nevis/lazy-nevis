import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/motion";
import { cn } from "@/utils/cn";

interface MetricSteps {
  step: number;
  presets: number[];
}

const METRIC_STEPS: Record<string, MetricSteps> = {
  count: { step: 1, presets: [1, 5, 10, 30, 50, 100] },
  duration: { step: 5, presets: [5, 10, 15, 30, 60] },
  volume: { step: 50, presets: [100, 250, 500, 1000] },
  mass: { step: 10, presets: [] },
  distance: { step: 100, presets: [] },
};

export function stepperConfig(metric: string): MetricSteps {
  return METRIC_STEPS[metric] ?? { step: 1, presets: [] };
}

/** Parses user-typed numbers, accepting both "1.5" and "1,5" (pt-BR). Returns null when invalid. */
export function parseDecimal(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (normalized === "") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.max(0, value) : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function ValueStepper({
  value,
  onChange,
  metric,
  unit,
  metricLabel,
  onEnter,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  metric: string;
  unit: string;
  metricLabel: string;
  /** Called with the committed value when Enter is pressed while typing. */
  onEnter?: (value: number) => void;
  className?: string;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });
  const { step, presets } = stepperConfig(metric);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const set = (next: number) => onChange(Math.max(0, round1(next)));

  const commit = (): number => {
    const parsed = parseDecimal(draft);
    setEditing(false);
    if (parsed == null) return value;
    set(parsed);
    return Math.max(0, round1(parsed));
  };

  const presetLabel = (amount: number) =>
    metric === "duration" && amount >= 60 && amount % 60 === 0
      ? t("preset_hours", { count: amount / 60 })
      : `+${amount}`;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-center gap-3">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-11 w-11 rounded-full"
          aria-label={t("stepper_decrease", { metric: metricLabel })}
          disabled={value <= 0}
          onClick={() => set(value - step)}
        >
          <Minus className="h-5 w-5" aria-hidden />
        </Button>
        <div className="flex min-w-[7rem] flex-col items-center">
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              aria-label={t("stepper_input", { metric: metricLabel })}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  const committed = commit();
                  onEnter?.(committed);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditing(false);
                }
              }}
              className="h-12 w-28 rounded-md border border-input bg-transparent text-center text-3xl font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          ) : (
            <button
              type="button"
              aria-label={t("stepper_edit", { value: round1(value), unit })}
              onClick={() => {
                setDraft(value > 0 ? String(round1(value)) : "");
                setEditing(true);
              }}
              className="rounded-md px-2 py-1 text-3xl font-semibold leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <AnimatedNumber
                value={round1(value)}
                // Whole targets stay whole while the spring runs, so 0 → 250 never shows 249.1.
                format={(n) => String(Number.isInteger(round1(value)) ? Math.round(n) : round1(n))}
              />
            </button>
          )}
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-11 w-11 rounded-full"
          aria-label={t("stepper_increase", { metric: metricLabel })}
          onClick={() => set(value + step)}
        >
          <Plus className="h-5 w-5" aria-hidden />
        </Button>
      </div>
      {presets.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {presets.map((amount) => (
            <Button
              key={amount}
              type="button"
              size="xs"
              variant="outline"
              onClick={() => set(value + amount)}
            >
              {presetLabel(amount)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

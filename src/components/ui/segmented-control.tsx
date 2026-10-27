import { useCallback, useRef } from "react";
import { cn } from "@/utils/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

type SegmentControlShared<T extends string> = {
  options: SegmentOption<T>[];
  className?: string;
  "aria-label": string;
};

export type SegmentedControlProps<T extends string> =
  | (SegmentControlShared<T> & {
      multiple?: false;
      value: T;
      onChange: (value: T) => void;
    })
  | (SegmentControlShared<T> & {
      multiple: true;
      value: T[];
      onChange: (value: T[]) => void;
    });

export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusOption = useCallback((index: number) => {
    const el = optionRefs.current[index];
    el?.focus();
  }, []);

  const onKeyDown = (index: number, e: React.KeyboardEvent) => {
    const enabled = props.options
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => !o.disabled);
    const pos = enabled.findIndex(({ i }) => i === index);
    if (pos < 0) return;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = enabled[(pos + 1) % enabled.length];
      focusOption(next.i);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = enabled[(pos - 1 + enabled.length) % enabled.length];
      focusOption(prev.i);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusOption(enabled[0].i);
    } else if (e.key === "End") {
      e.preventDefault();
      focusOption(enabled[enabled.length - 1].i);
    }
  };

  const select = (value: T) => {
    if (props.multiple) {
      const set = new Set(props.value);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      props.onChange([...set]);
    } else {
      props.onChange(value);
    }
  };

  return (
    <div
      role={props.multiple ? "group" : "radiogroup"}
      aria-label={props["aria-label"]}
      className={cn(
        "inline-flex rounded-lg border border-border bg-muted/50 p-0.5",
        props.className,
      )}
    >
      {props.options.map((opt, index) => {
        const selected = props.multiple
          ? props.value.includes(opt.value)
          : props.value === opt.value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              optionRefs.current[index] = el;
            }}
            type="button"
            role={props.multiple ? undefined : "radio"}
            aria-checked={props.multiple ? undefined : selected}
            aria-pressed={props.multiple ? selected : undefined}
            disabled={opt.disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(opt.value)}
            onKeyDown={(e) => onKeyDown(index, e)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              opt.disabled && "pointer-events-none opacity-50",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";
import { useAnchoredPosition } from "@/components/ui/popover";
import { cn } from "@/utils/cn";

interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  className?: string;
  children?: React.ReactNode;
}

function optionsFromChildren(children: React.ReactNode): SelectOption[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement(child)) return [];
    const props = child.props as { value?: unknown; disabled?: boolean; children?: React.ReactNode };
    return [
      {
        value: String(props.value ?? ""),
        label: props.children,
        disabled: props.disabled,
      },
    ];
  });
}

/**
 * Custom-styled, keyboard-accessible listbox that mirrors the native
 * `<select>` API (value / onChange / <option> children) so existing call
 * sites don't change, while matching Input/DropdownMenu visuals instead of
 * the unstyled OS control.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, value, onChange, disabled, id, "aria-label": ariaLabel, name }, ref) => {
    const options = React.useMemo(() => optionsFromChildren(children), [children]);
    const [open, setOpen] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(0);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const listRef = React.useRef<HTMLUListElement>(null);
    const hiddenSelectRef = React.useRef<HTMLSelectElement>(null);
    const listboxId = React.useId();
    // Portal + fixed position: the list flips above the trigger near the bottom edge and is never clipped.
    const position = useAnchoredPosition(
      open,
      () => triggerRef.current?.getBoundingClientRect() ?? null,
      listRef,
      "start",
    );
    const placed = position !== null;
    React.useEffect(() => {
      if (open && placed) listRef.current?.focus({ preventScroll: true });
    }, [open, placed]);

    React.useImperativeHandle(ref, () => hiddenSelectRef.current as HTMLSelectElement);

    const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
    const selected = options[selectedIndex];

    const emitChange = (nextValue: string) => {
      const select = hiddenSelectRef.current;
      if (select) {
        select.value = nextValue;
        const event = new Event("change", { bubbles: true });
        Object.defineProperty(event, "target", { writable: false, value: select });
        onChange?.(event as unknown as React.ChangeEvent<HTMLSelectElement>);
      }
    };

    const close = React.useCallback(() => {
      setOpen(false);
      triggerRef.current?.focus();
    }, []);

    const commit = (index: number) => {
      const option = options[index];
      if (!option || option.disabled) return;
      emitChange(option.value);
      close();
    };

    React.useEffect(() => {
      if (!open) return;
      setActiveIndex(selectedIndex === -1 ? 0 : selectedIndex);
      const onDoc = (e: MouseEvent) => {
        const t = e.target as Node;
        if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return;
        close();
      };
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const moveActive = (delta: number) => {
      setActiveIndex((prev) => {
        let next = prev;
        for (let i = 0; i < options.length; i += 1) {
          next = (next + delta + options.length) % options.length;
          if (!options[next]?.disabled) break;
        }
        return next;
      });
    };

    const onTriggerKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
    };

    const onListKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        moveActive(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveActive(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setActiveIndex(options.length - 1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        commit(activeIndex);
      } else if (e.key === "Tab") {
        close();
      }
    };

    React.useEffect(() => {
      if (open) {
        const el = listRef.current?.querySelector<HTMLLIElement>(`[data-index="${activeIndex}"]`);
        el?.scrollIntoView?.({ block: "nearest" });
      }
    }, [open, activeIndex]);

    return (
      <div className={cn("relative inline-block", className)}>
        {/* Hidden native select keeps form semantics + onChange contract identical to before. */}
        <select
          ref={hiddenSelectRef}
          tabIndex={-1}
          aria-hidden
          name={name}
          value={value}
          onChange={() => {}}
          className="sr-only"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {typeof o.label === "string" ? o.label : o.value}
            </option>
          ))}
        </select>

        <button
          ref={triggerRef}
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-label={ariaLabel}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={onTriggerKeyDown}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors",
            "hover:bg-accent/40",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <span className="truncate text-left">{selected?.label ?? value}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>

        {open &&
          createPortal(
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            onKeyDown={onListKeyDown}
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              minWidth: triggerRef.current?.offsetWidth,
              maxHeight: Math.min(240, position?.maxHeight ?? 240),
              visibility: position ? "visible" : "hidden",
            }}
            className="fixed z-[95] overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(index)}
                  className={cn(
                    "flex cursor-default items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    index === activeIndex && !option.disabled && "bg-accent text-foreground",
                    option.disabled && "pointer-events-none opacity-50",
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };

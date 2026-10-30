import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/utils/cn";

export interface DropdownMenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export function DropdownMenu({
  trigger,
  items,
  align = "start",
  className,
  triggerClassName,
}: {
  trigger: ReactNode;
  items: DropdownMenuItem[];
  align?: "start" | "end";
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const enabledIndices = items
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => !item.disabled)
    .map(({ i }) => i);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (itemRefs.current.some((el) => el?.contains(t))) return;
      close();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, close]);

  const runItem = (index: number) => {
    const item = items[index];
    if (!item || item.disabled) return;
    item.onSelect();
    close();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
      const first = enabledIndices[0] ?? 0;
      setActiveIndex(first);
      requestAnimationFrame(() => itemRefs.current[first]?.focus());
    }
  };

  const onMenuKeyDown = (index: number, e: React.KeyboardEvent) => {
    const pos = enabledIndices.indexOf(index);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = enabledIndices[(pos + 1) % enabledIndices.length] ?? index;
      setActiveIndex(next);
      itemRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev =
        enabledIndices[(pos - 1 + enabledIndices.length) % enabledIndices.length] ?? index;
      setActiveIndex(prev);
      itemRefs.current[prev]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      const first = enabledIndices[0] ?? 0;
      setActiveIndex(first);
      itemRefs.current[first]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      const last = enabledIndices[enabledIndices.length - 1] ?? 0;
      setActiveIndex(last);
      itemRefs.current[last]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      runItem(index);
    }
  };

  return (
    <div className={cn("relative inline-flex", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className={cn("inline-flex", triggerClassName)}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className={cn(
            "absolute z-50 mt-1 min-w-[10rem] rounded-lg border border-border bg-popover py-1 shadow-lg",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={index === activeIndex ? 0 : -1}
              disabled={item.disabled}
              onClick={() => runItem(index)}
              onKeyDown={(e) => onMenuKeyDown(index, e)}
              className={cn(
                "flex w-full px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:bg-accent",
                item.destructive
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-foreground hover:bg-accent",
                item.disabled && "pointer-events-none opacity-50",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/cn";

const GAP = 6;
const VIEWPORT_MARGIN = 8;

/**
 * Click-to-open popover rendered in a portal with fixed positioning, so it works
 * inside scrolling dialogs. Flips above the trigger when there is no room below.
 */
export function Popover({
  trigger,
  children,
  align = "start",
  className,
  triggerClassName,
  ariaLabel,
  disabled,
}: {
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  className?: string;
  triggerClassName?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const place = () => {
      const anchor = triggerRef.current?.getBoundingClientRect();
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const { width, height } = panel.getBoundingClientRect();
      const fitsBelow = anchor.bottom + GAP + height <= window.innerHeight - VIEWPORT_MARGIN;
      const top = fitsBelow ? anchor.bottom + GAP : Math.max(VIEWPORT_MARGIN, anchor.top - GAP - height);
      const rawLeft = align === "end" ? anchor.right - width : anchor.left;
      const left = Math.min(
        Math.max(VIEWPORT_MARGIN, rawLeft),
        window.innerWidth - width - VIEWPORT_MARGIN,
      );
      setPosition({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    // Capture phase so Escape closes only the popover, not an enclosing dialog.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? "visible" : "hidden",
            }}
            className={cn(
              "fixed z-[90] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg",
              className,
            )}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  );
}

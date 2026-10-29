import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { cn } from "@/utils/cn";

const GAP = 6;
const VIEWPORT_MARGIN = 8;

type Rect = Pick<DOMRect, "top" | "bottom" | "left" | "right">;

/** Fixed position for a panel anchored to a rect: below when it fits, else above; clamped to the viewport. */
export function useAnchoredPosition(
  open: boolean,
  getAnchor: () => Rect | null,
  panelRef: React.RefObject<HTMLElement | null>,
  align: "start" | "end",
) {
  const [position, setPosition] = useState<{ top: number; left: number; above: boolean; maxHeight: number } | null>(null);
  const anchorRef = useRef(getAnchor);
  anchorRef.current = getAnchor;

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const place = () => {
      const anchor = anchorRef.current();
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      // Layout size, not getBoundingClientRect: an entrance scale would shrink the measurement.
      const width = panel.offsetWidth;
      const height = panel.scrollHeight + (panel.offsetHeight - panel.clientHeight);
      // Open on the side with more room (preferring below) and cap the height to it, so a tall
      // panel near an edge scrolls instead of spilling out of the window.
      const spaceBelow = window.innerHeight - anchor.bottom - GAP - VIEWPORT_MARGIN;
      const spaceAbove = anchor.top - GAP - VIEWPORT_MARGIN;
      const above = height > spaceBelow && spaceAbove > spaceBelow;
      const maxHeight = Math.max(120, above ? spaceAbove : spaceBelow);
      const shown = Math.min(height, maxHeight);
      const top = above ? anchor.top - GAP - shown : anchor.bottom + GAP;
      const rawLeft = align === "end" ? anchor.right - width : anchor.left;
      const left = Math.min(
        Math.max(VIEWPORT_MARGIN, rawLeft),
        window.innerWidth - width - VIEWPORT_MARGIN,
      );
      setPosition({ top: Math.max(VIEWPORT_MARGIN, top), left, above, maxHeight });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align, panelRef]);

  return position;
}

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const position = useAnchoredPosition(
    open,
    () => triggerRef.current?.getBoundingClientRect() ?? null,
    panelRef,
    align,
  );

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
              maxHeight: position?.maxHeight,
              visibility: position ? "visible" : "hidden",
            }}
            className={cn(
              "fixed z-[90] overflow-y-auto rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg",
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

/**
 * Floating panel anchored to an arbitrary element (e.g. a clicked calendar cell). Closes on outside
 * click or Escape; Escape is captured so an enclosing dialog stays open.
 */
export function AnchoredPanel({
  anchor,
  onClose,
  children,
  className,
  ariaLabel,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const position = useAnchoredPosition(true, () => anchor.getBoundingClientRect(), panelRef, "start");
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchor.contains(target)) return;
      onCloseRef.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onCloseRef.current();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [anchor]);

  // The whole panel (frame included) zooms and fades, so an AnimatePresence exit leaves nothing behind.
  return createPortal(
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-label={ariaLabel}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.14, ease: "easeIn" } }}
      transition={{ type: "spring", bounce: 0.2, visualDuration: 0.2 }}
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        maxHeight: position?.maxHeight,
        visibility: position ? "visible" : "hidden",
        transformOrigin: position?.above ? "bottom left" : "top left",
      }}
      className={cn(
        "fixed z-[80] overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-xl",
        className,
      )}
    >
      {children}
    </motion.div>,
    document.body,
  );
}

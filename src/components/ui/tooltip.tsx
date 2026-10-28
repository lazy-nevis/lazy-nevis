import { useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/cn";

type TooltipSide = "right" | "top" | "bottom";

const GAP = 6;

/**
 * Hover/focus tooltip rendered in a portal with fixed positioning, so it is never
 * clipped by (or adds scroll to) overflow containers such as the collapsed sidebar.
 */
export function Tooltip({
  label,
  children,
  side = "right",
  className,
}: {
  label: string;
  children: ReactNode;
  side?: TooltipSide;
  className?: string;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const show = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (side === "top") setPosition({ top: rect.top - GAP, left: rect.left + rect.width / 2 });
    else if (side === "bottom")
      setPosition({ top: rect.bottom + GAP, left: rect.left + rect.width / 2 });
    else setPosition({ top: rect.top + rect.height / 2, left: rect.right + GAP });
  }, [side]);

  const hide = useCallback(() => setPosition(null), []);

  const transform =
    side === "top"
      ? "translate(-50%, -100%)"
      : side === "bottom"
        ? "translate(-50%, 0)"
        : "translate(0, -50%)";

  return (
    <span
      ref={anchorRef}
      className={cn("inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {position &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: position.top, left: position.left, transform }}
            className="pointer-events-none fixed z-[100] whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground shadow-md motion-safe:animate-in motion-safe:fade-in-0"
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}

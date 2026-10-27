import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export function Tooltip({
  label,
  children,
  side = "right",
  className,
}: {
  label: string;
  children: ReactNode;
  side?: "right" | "top" | "bottom";
  className?: string;
}) {
  const sideClass =
    side === "top"
      ? "bottom-full left-1/2 mb-1.5 -translate-x-1/2"
      : side === "bottom"
        ? "top-full left-1/2 mt-1.5 -translate-x-1/2"
        : "left-full top-1/2 ml-1.5 -translate-y-1/2";

  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[11px] text-popover-foreground opacity-0 shadow-md transition-opacity",
          "group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100",
          sideClass,
        )}
      >
        {label}
      </span>
    </span>
  );
}

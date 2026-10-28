import { motion } from "motion/react";
import { cn } from "@/utils/cn";

/** Progress bar whose fill grows from the old value to the new one. `value` is 0–100. */
export function AnimatedProgress({
  value,
  color,
  className,
  barClassName,
  label,
}: {
  value: number;
  color?: string;
  className?: string;
  barClassName?: string;
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
      className={cn("h-2 overflow-hidden rounded-full bg-muted/80", className)}
    >
      <motion.div
        className={cn("h-full origin-left rounded-full bg-primary", barClassName)}
        style={color ? { backgroundColor: color } : undefined}
        initial={false}
        animate={{ scaleX: clamped / 100 }}
        transition={{ type: "spring", bounce: 0.15, visualDuration: 0.5 }}
      />
    </div>
  );
}

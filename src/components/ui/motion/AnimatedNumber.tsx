import { useEffect } from "react";
import { motion, useSpring, useTransform } from "motion/react";
import { cn } from "@/utils/cn";

/** Number that springs from its previous value to the new one. */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const spring = useSpring(value, { bounce: 0, visualDuration: 0.4 });
  const text = useTransform(() => format(spring.get()));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span className={cn("tabular-nums", className)}>{text}</motion.span>;
}

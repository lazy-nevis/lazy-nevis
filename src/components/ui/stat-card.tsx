import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export function StatCard({
  label,
  value,
  hint,
  trend,
  icon: Icon,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: { label: string; positive?: boolean };
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {trend && (
        <p
          className={cn(
            "mt-2 text-xs font-medium",
            trend.positive ? "text-success" : "text-muted-foreground",
          )}
        >
          {trend.label}
        </p>
      )}
    </div>
  );
}

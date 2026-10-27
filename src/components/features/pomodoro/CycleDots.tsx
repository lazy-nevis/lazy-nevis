import { cn } from "@/utils/cn";

interface CycleDotsProps {
  completed: number;
  total: number;
}

export function CycleDots({ completed, total }: CycleDotsProps) {
  return (
    <div className="flex items-center gap-2" role="presentation" aria-hidden>
      {Array.from({ length: total }, (_, index) => {
        const done = index < completed;
        const current = index === completed;
        return (
          <span
            key={index}
            className={cn(
              "size-2.5 rounded-full motion-safe:transition-colors",
              done && "bg-brand",
              !done && !current && "bg-muted",
              current && "bg-brand/30 ring-2 ring-brand ring-offset-2 ring-offset-background",
            )}
          />
        );
      })}
    </div>
  );
}

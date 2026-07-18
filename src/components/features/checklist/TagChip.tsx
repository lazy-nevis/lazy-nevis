import { cn } from "@/utils/cn";

interface Props {
  name: string;
  active?: boolean;
  onClick?: (name: string) => void;
  className?: string;
}

export function TagChip({ name, active = false, onClick, className }: Props) {
  const base = cn(
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
    active
      ? "border-transparent bg-primary text-primary-foreground"
      : "border-border bg-muted/60 text-muted-foreground",
    onClick && "cursor-pointer hover:bg-accent hover:text-accent-foreground",
    className,
  );
  if (!onClick) {
    return <span className={base}>#{name}</span>;
  }
  return (
    <button type="button" className={base} onClick={() => onClick(name)}>
      #{name}
    </button>
  );
}

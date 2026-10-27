import type { ReactNode } from "react";
import type { Tone } from "@/utils/tones";
import { toneStyle } from "@/utils/tones";
import { cn } from "@/utils/cn";

export function GlowCard({
  tone = "slate",
  header,
  children,
  footer,
  className,
}: {
  tone?: Tone;
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
      style={toneStyle(tone)}
    >
      <div className="pointer-events-none absolute inset-0 tone-glow opacity-80" aria-hidden />
      <div className="relative flex flex-col">
        {header && (
          <header className="border-b border-border/60 px-4 py-3">{header}</header>
        )}
        <div className="px-4 py-3">{children}</div>
        {footer && (
          <footer className="border-t border-border/60 px-4 py-3">{footer}</footer>
        )}
      </div>
    </article>
  );
}

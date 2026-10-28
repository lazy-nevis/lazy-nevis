import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";

const MIN_THUMB = 24;

/**
 * Vertical scroll container with a floating thumb drawn over the content, so the
 * scrollbar never reserves layout width. The native scrollbar stays hidden.
 */
export function ScrollArea({
  children,
  className,
  viewportClassName,
  contentClassName,
}: {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  contentClassName?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startTop: number } | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null);
  const [active, setActive] = useState(false);

  const measure = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { scrollHeight, clientHeight, scrollTop } = el;
    if (scrollHeight <= clientHeight + 1) {
      setThumb(null);
      return;
    }
    const height = Math.max(MIN_THUMB, (clientHeight / scrollHeight) * clientHeight);
    const top = (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - height);
    setThumb({ top, height });
  }, []);

  const flash = useCallback(() => {
    setActive(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setActive(false), 900);
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => {
      observer.disconnect();
      window.clearTimeout(hideTimer.current);
    };
  }, [measure]);

  const onThumbPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = viewportRef.current;
    if (!el) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startY: event.clientY, startTop: el.scrollTop };
  };

  const onThumbPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = viewportRef.current;
    const drag = dragRef.current;
    if (!el || !drag || !thumb) return;
    const track = el.clientHeight - thumb.height;
    if (track <= 0) return;
    const ratio = (el.scrollHeight - el.clientHeight) / track;
    el.scrollTop = drag.startTop + (event.clientY - drag.startY) * ratio;
  };

  return (
    <div className={cn("group/scroll relative min-h-0", className)}>
      <div
        ref={viewportRef}
        onScroll={() => {
          measure();
          flash();
        }}
        className={cn("scrollbar-none overflow-y-auto", viewportClassName)}
      >
        <div ref={contentRef} className={contentClassName}>{children}</div>
      </div>
      {thumb && (
        <div
          aria-hidden
          onPointerDown={onThumbPointerDown}
          onPointerMove={onThumbPointerMove}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          style={{ top: thumb.top, height: thumb.height }}
          className={cn(
            "absolute right-0.5 w-1.5 cursor-default rounded-full bg-muted-foreground/40 transition-opacity duration-300 hover:w-2 hover:bg-muted-foreground/60",
            active ? "opacity-100" : "opacity-0 group-hover/scroll:opacity-70",
          )}
        />
      )}
    </div>
  );
}

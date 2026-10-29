import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { cn } from "@/utils/cn";

const MIN_THUMB = 24;

/** Mantine-style visibility: `hover` while the pointer is over, `scroll` while scrolling, `always`/`auto` whenever it overflows. */
export type ScrollAreaType = "auto" | "always" | "hover" | "scroll" | "never";

export interface ScrollAreaProps {
  children: ReactNode;
  /** Sizing/positioning of the outer box (e.g. `min-h-0 flex-1`). */
  className?: string;
  viewportClassName?: string;
  contentClassName?: string;
  viewportRef?: Ref<HTMLDivElement>;
  /** Default `hover`. */
  type?: ScrollAreaType;
  /** Reserve room for the bar when the content overflows. Default false: the bar floats over the content. */
  offsetScrollbars?: boolean;
  overscrollBehavior?: CSSProperties["overscrollBehavior"];
  /** Delay in ms before the bar hides after hover/scroll ends. Default 800. */
  scrollHideDelay?: number;
  /** Bar thickness in px. Default 8. */
  scrollbarSize?: number;
  onScroll?: () => void;
}

/**
 * Vertical scroll container with a floating thumb drawn over the content (no layout width).
 * The native scrollbar stays hidden; visibility, delay, size, offset and overscroll are props.
 */
export function ScrollArea({
  children,
  className,
  viewportClassName,
  contentClassName,
  viewportRef,
  type = "hover",
  offsetScrollbars = false,
  overscrollBehavior,
  scrollHideDelay = 800,
  scrollbarSize = 8,
  onScroll,
}: ScrollAreaProps) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startTop: number } | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null);
  const [scrolling, setScrolling] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [dragging, setDragging] = useState(false);

  const setViewport = (node: HTMLDivElement | null) => {
    innerRef.current = node;
    if (typeof viewportRef === "function") viewportRef(node);
    else if (viewportRef) (viewportRef as { current: HTMLDivElement | null }).current = node;
  };

  const measure = useCallback(() => {
    const el = innerRef.current;
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

  const later = useCallback(
    (fn: () => void) => {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(fn, scrollHideDelay);
    },
    [scrollHideDelay],
  );

  useEffect(() => {
    const el = innerRef.current;
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

  const visible =
    thumb !== null &&
    type !== "never" &&
    (type === "always" || type === "auto" || dragging || (type === "hover" ? hovering : scrolling));

  const onThumbPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = innerRef.current;
    if (!el) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startY: event.clientY, startTop: el.scrollTop };
    setDragging(true);
  };

  const onThumbPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = innerRef.current;
    const drag = dragRef.current;
    if (!el || !drag || !thumb) return;
    const track = el.clientHeight - thumb.height;
    if (track <= 0) return;
    const ratio = (el.scrollHeight - el.clientHeight) / track;
    el.scrollTop = drag.startTop + (event.clientY - drag.startY) * ratio;
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  return (
    <div
      className={cn("relative min-h-0", className)}
      onPointerEnter={() => {
        window.clearTimeout(hideTimer.current);
        setHovering(true);
      }}
      onPointerLeave={() => later(() => setHovering(false))}
    >
      <div
        ref={setViewport}
        onScroll={() => {
          measure();
          onScroll?.();
          setScrolling(true);
          later(() => setScrolling(false));
        }}
        style={{
          overscrollBehavior,
          paddingRight: offsetScrollbars && thumb ? scrollbarSize + 4 : undefined,
        }}
        className={cn("scrollbar-none h-full max-h-[inherit] overflow-y-auto", viewportClassName)}
      >
        <div ref={contentRef} className={contentClassName}>
          {children}
        </div>
      </div>
      {thumb && (
        <div
          aria-hidden
          onPointerDown={onThumbPointerDown}
          onPointerMove={onThumbPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ top: thumb.top, height: thumb.height, width: scrollbarSize }}
          className={cn(
            "absolute right-0.5 z-10 cursor-default rounded-full bg-muted-foreground/45 transition-opacity duration-200 hover:bg-muted-foreground/70",
            visible ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />
      )}
    </div>
  );
}

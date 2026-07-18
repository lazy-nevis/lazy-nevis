import { IS_MAC } from "@/utils/platform";

/**
 * Custom title bar for the macOS overlay style (`titleBarStyle: Overlay`):
 * native traffic lights float over the left edge, the bar is a drag region, and
 * the screen name is centered on the window — matching how native macOS title
 * bars center their title regardless of where the traffic lights sit — instead
 * of being tucked in next to them. Windows/Linux keep the native title bar, so
 * this renders only on macOS.
 * Spec: app-modes/custom-title-bar.
 */
export function TitleBar({ title }: { title: string }) {
  if (!IS_MAC) return null;
  return (
    <header
      data-tauri-drag-region
      className="relative flex h-9 shrink-0 select-none items-center border-b bg-card"
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="text-[13px] font-medium text-foreground/80">{title}</span>
      </div>
    </header>
  );
}

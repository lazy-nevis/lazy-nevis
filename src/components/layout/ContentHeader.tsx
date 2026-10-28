import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { useSessionStore } from "@/stores/sessionStore";
import { formatDuration } from "@/utils/formatters";
import { IS_MAC } from "@/utils/platform";
import { cn } from "@/utils/cn";

export function ContentHeader({
  screenTitle,
  collapsed,
  onToggleCollapse,
  onOpenPalette,
}: {
  screenTitle: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenPalette: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeSession = useSessionStore((s) => s.activeSession);
  const liveStats = useSessionStore((s) => s.liveStats);

  const onDoubleClick = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = await getCurrentWindow();
      await win.toggleMaximize();
    } catch {
      /* non-tauri test env */
    }
  }, []);

  const modLabel = IS_MAC ? "⌘" : "Ctrl";

  return (
    <header
      data-tauri-drag-region
      onDoubleClick={onDoubleClick}
      className={cn(
        "flex h-12 shrink-0 select-none items-center gap-2 border-b border-border bg-background px-3",
        // Collapsed sidebar is narrower than the macOS traffic lights; keep the
        // toggle to their right instead of underneath them.
        IS_MAC && collapsed && "pl-6",
      )}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label={collapsed ? t("shell.expand_sidebar") : t("shell.collapse_sidebar")}
        title={collapsed ? t("shell.expand_sidebar") : t("shell.collapse_sidebar")}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </button>

      <nav
        data-tauri-drag-region
        aria-label={t("shell.breadcrumb")}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-muted-foreground"
      >
        <span data-tauri-drag-region className="shrink-0 font-medium text-foreground/80">
          LazyNevis
        </span>
        <span data-tauri-drag-region aria-hidden>
          /
        </span>
        <span
          data-tauri-drag-region
          className="truncate font-medium text-foreground"
          title={screenTitle}
        >
          {screenTitle}
        </span>
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        {activeSession && (
          <button
            type="button"
            onClick={() => navigate("/sessions")}
            className={cn(
              "flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium transition-colors hover:bg-accent",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                liveStats?.is_paused ? "bg-warning" : "bg-success animate-pulse",
              )}
              aria-hidden
            />
            <span className="font-mono tabular-nums">
              {formatDuration(liveStats?.total_ms ?? 0)}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={onOpenPalette}
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={t("command_palette.open")}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("command_palette.search_placeholder")}</span>
          <Kbd>{modLabel}K</Kbd>
        </button>
      </div>
    </header>
  );
}

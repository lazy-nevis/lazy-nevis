import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Minimize2 } from "lucide-react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { appModeService, overlayService, sessionService } from "@/services/tauri";
import { useAppStatusStore } from "@/stores/appStatusStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { formatDuration } from "@/utils/formatters";
import { cn } from "@/utils/cn";
import iconDark from "@/assets/brand/icon-dark.png";
import iconLight from "@/assets/brand/icon-light.png";

export function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeSession = useSessionStore((s) => s.activeSession);
  const liveStats = useSessionStore((s) => s.liveStats);
  const resetCheckpoints = useSessionStore((s) => s.resetCheckpoints);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const isFullscreen = useAppStatusStore((s) => s.isFullscreen);
  const theme = useSettingsStore((s) => s.settings.general.theme);
  const { setStartModalOpen } = useUiStore();

  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) ||
    document.documentElement.classList.contains("dark");
  const iconSrc = isDark ? iconLight : iconDark;

  const isPaused = liveStats?.is_paused ?? false;
  const elapsed = liveStats?.total_ms ?? 0;

  let statusLine = t("shell.brand_no_session");
  if (activeSession) {
    const time = formatDuration(elapsed);
    statusLine = isPaused
      ? t("shell.brand_paused", { time })
      : t("shell.brand_focusing", { time });
  }

  const menuItems = [
    ...(!isFullscreen
      ? [
          {
            id: "compact",
            label: t("app_modes.switch_to_compact"),
            onSelect: () => void appModeService.setMode("compact"),
          },
        ]
      : []),
    activeSession
      ? {
          id: "stop",
          label: t("dashboard.session.stop_button"),
          onSelect: () => {
            void sessionService.stop().then(async () => {
              await overlayService.cancelActive().catch(() => {});
              setActiveSession(null);
              resetCheckpoints();
            });
          },
          destructive: true,
        }
      : {
          id: "start",
          label: t("dashboard.session.start_button"),
          onSelect: () => setStartModalOpen(true),
        },
    {
      id: "about",
      label: t("nav.about"),
      onSelect: () => navigate("/about"),
    },
  ];

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2",
        collapsed && "flex-col justify-center gap-1 px-0",
      )}
    >
      <DropdownMenu
        align="start"
        trigger={
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent",
              collapsed && "flex-none justify-center px-1",
            )}
          >
            <img
              src={iconSrc}
              alt=""
              className="h-8 w-8 shrink-0 rounded-lg object-contain"
              draggable={false}
            />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold leading-tight">LazyNevis</p>
                <p className="truncate text-[11px] text-muted-foreground">{statusLine}</p>
              </div>
            )}
          </div>
        }
        items={menuItems}
      />
      {!collapsed && !isFullscreen && (
        <button
          type="button"
          onClick={() => void appModeService.setMode("compact")}
          title={t("app_modes.switch_to_compact")}
          aria-label={t("app_modes.switch_to_compact")}
          className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
      )}
      {collapsed && !isFullscreen && (
        <button
          type="button"
          onClick={() => void appModeService.setMode("compact")}
          title={t("app_modes.switch_to_compact")}
          aria-label={t("app_modes.switch_to_compact")}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

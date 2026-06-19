import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, History, Settings, Info } from "lucide-react";
import { cn } from "@/utils/cn";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import iconDark from "@/assets/brand/icon-dark.png";
import iconLight from "@/assets/brand/icon-light.png";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "nav.dashboard" },
  { to: "/history", icon: History, label: "nav.history" },
  { to: "/settings", icon: Settings, label: "nav.settings" },
  { to: "/about", icon: Info, label: "nav.about" },
];

export function Sidebar() {
  const { t } = useTranslation();
  const activeSession = useSessionStore((s) => s.activeSession);
  const theme = useSettingsStore((s) => s.settings.general.theme);
  const updateAvailable = useUiStore((s) => s.updateAvailable);

  // Determine effective dark mode from settings + system preference
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) ||
    document.documentElement.classList.contains("dark");

  // icon-dark (dark artwork, dark bg) → show on LIGHT UI so it stands out
  // icon-light (light artwork, light bg) → show on DARK UI so it stands out
  const iconSrc = isDark ? iconLight : iconDark;

  return (
    <aside className="flex h-full w-16 flex-col items-center border-r bg-card py-3 gap-1">
      {/* App icon → always goes to Home (Dashboard) */}
      <NavLink
        to="/"
        end
        className="flex h-10 w-10 items-center justify-center mb-1"
        title={t("nav.dashboard")}
      >
        <img
          src={iconSrc}
          alt="LazyNevis"
          className="h-8 w-8 object-contain rounded-lg"
          draggable={false}
        />
      </NavLink>

      {/* Session status dot */}
      <div className="mb-1 flex items-center justify-center">
        <div
          className={cn(
            "h-2 w-2 rounded-full transition-colors",
            activeSession ? "bg-green-500 animate-pulse" : "bg-muted-foreground/20"
          )}
          role="status"
          aria-label={activeSession ? t("dashboard.session.status_focused") : t("dashboard.session.status_inactive")}
          title={activeSession ? t("dashboard.session.status_focused") : t("dashboard.session.status_inactive")}
        />
      </div>

      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            cn(
              "relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              isActive && "bg-accent text-accent-foreground"
            )
          }
          title={t(label)}
        >
          <Icon className="h-5 w-5" />
          {to === "/about" && updateAvailable && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" aria-label={t("about.update_available", { version: updateAvailable })} />
          )}
        </NavLink>
      ))}
    </aside>
  );
}

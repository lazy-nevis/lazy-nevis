import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/utils/cn";
import logoDark from "@/assets/brand/logo-dark.png";
import logoLight from "@/assets/brand/logo-light.png";

/**
 * Horizontal brand logo that follows the effective theme:
 * logo-dark (dark artwork) on light backgrounds, logo-light on dark ones.
 */
export function BrandLogo({ className }: { className?: string }) {
  const theme = useSettingsStore((s) => s.settings.general.theme);
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) ||
    document.documentElement.classList.contains("dark");

  return (
    <img
      src={isDark ? logoLight : logoDark}
      alt="LazyNevis"
      className={cn("object-contain", className)}
      draggable={false}
    />
  );
}

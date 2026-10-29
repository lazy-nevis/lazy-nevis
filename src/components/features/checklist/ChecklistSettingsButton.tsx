import { Settings as SettingsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { appModeService } from "@/services/tauri";
import { requestSettingsTab } from "@/utils/settingsNav";
import { cn } from "@/utils/cn";

/** Jumps to Settings → Checklist (categories live there). `secondary` opens the settings window instead of routing. */
export function ChecklistSettingsButton({
  secondary = false,
  className,
}: {
  secondary?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const open = () => {
    requestSettingsTab("checklist");
    if (secondary) void appModeService.openSecondary("settings").catch(() => {});
    else window.location.hash = "#/settings";
  };
  return (
    <button
      type="button"
      onClick={open}
      title={t("checklist.open_settings")}
      aria-label={t("checklist.open_settings")}
      className={cn("rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", className)}
    >
      <SettingsIcon className="h-3.5 w-3.5" />
    </button>
  );
}

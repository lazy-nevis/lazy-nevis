import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, AlertTriangle, XCircle, ExternalLink, Shield } from "lucide-react";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { permissionsService } from "@/services/tauri";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/utils/cn";
import type { PermissionState, PermissionsStatus } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

function PermIcon({ state }: { state: PermissionState }) {
  if (state === "granted")
    return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
  if (state === "denied")
    return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
  if (state === "notrequired")
    return <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
  return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />;
}

function statusLabel(state: PermissionState, t: (k: string) => string): string {
  switch (state) {
    case "granted":     return t("permissions.status.granted");
    case "denied":      return t("permissions.status.denied");
    case "notrequired": return t("permissions.status.not_required");
    default:            return t("permissions.status.not_determined");
  }
}

export function PermissionsModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PermissionsStatus | null>(null);
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, notif] = await Promise.all([
        permissionsService.check(),
        isPermissionGranted(),
      ]);
      setStatus(s);
      setNotifGranted(notif);
    } catch (e) {
      console.error("Permission check failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const requestNotif = async () => {
    const result = await requestPermission();
    setNotifGranted(result === "granted");
    await refresh();
  };

  const isMac = status?.platform === "macos";
  const allOk =
    notifGranted &&
    (status?.accessibility === "granted" || status?.accessibility === "notrequired");

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <DialogTitle>{t("permissions.title")}</DialogTitle>
        </div>
        <DialogClose onClose={onClose} />
      </DialogHeader>

      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        {t("permissions.intro")}
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <div className="space-y-3">
          {/* Notifications */}
          <PermRow
            icon={<PermIcon state={notifGranted ? "granted" : "notdetermined"} />}
            label={t("permissions.notifications.label")}
            desc={t("permissions.notifications.desc")}
            status={statusLabel(notifGranted ? "granted" : "notdetermined", t)}
            stateVal={notifGranted ? "granted" : "notdetermined"}
          >
            {!notifGranted && (
              <Button size="sm" onClick={requestNotif}>
                {t("permissions.request")}
              </Button>
            )}
          </PermRow>

          {/* Accessibility / Automation (macOS) */}
          {isMac && (
            <PermRow
              icon={<PermIcon state={status?.accessibility ?? "notdetermined"} />}
              label={t("permissions.accessibility.label")}
              desc={t("permissions.accessibility.desc")}
              status={statusLabel(status?.accessibility ?? "notdetermined", t)}
              stateVal={status?.accessibility ?? "notdetermined"}
            >
              {status?.accessibility !== "granted" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={async () => {
                    await permissionsService.openAccessibilitySettings();
                    // Give a moment for the user to grant, then re-check
                    setTimeout(refresh, 3000);
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("permissions.open_settings")}
                </Button>
              )}
            </PermRow>
          )}
        </div>
      )}

      {allOk && (
        <div className="mt-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-3 py-2.5 flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {t("permissions.all_ok")}
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {t("permissions.recheck")}
        </Button>
        <Button onClick={onClose}>{t("common.close")}</Button>
      </DialogFooter>
    </Dialog>
  );
}

function PermRow({
  icon,
  label,
  desc,
  status,
  stateVal,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  status: string;
  stateVal: PermissionState;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn(
      "rounded-lg border p-3",
      stateVal === "granted" ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30"
      : stateVal === "denied" ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30"
      : "border-border"
    )}>
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium">{label}</p>
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded-full font-medium",
              stateVal === "granted" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : stateVal === "denied" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
            )}>
              {status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
        </div>
        {children && <div className="shrink-0 ml-2">{children}</div>}
      </div>
    </div>
  );
}

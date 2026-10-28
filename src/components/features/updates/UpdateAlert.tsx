import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { selectAlertRelease, useUpdateStore } from "@/stores/updateStore";

/** Dismissible orange banner announcing a newer release (spec: release-update-check/proactive-notice). */
export function UpdateAlert() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const release = useUpdateStore(selectAlertRelease);
  const dismiss = useUpdateStore((s) => s.dismiss);

  return (
    <AnimatePresence initial={false}>
      {release && (
        <motion.div
          key={release.version}
          role="status"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-3 rounded-xl border border-notice/40 bg-notice/10 px-4 py-3"
        >
          <Download className="h-4 w-4 shrink-0 text-notice" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {t("update.alert_title", { version: release.version })}
            </p>
            <p className="text-xs text-muted-foreground">{t("update.alert_body")}</p>
          </div>
          <Button size="sm" onClick={() => navigate("/about")}>
            {t("update.view_details")}
          </Button>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("update.dismiss")}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

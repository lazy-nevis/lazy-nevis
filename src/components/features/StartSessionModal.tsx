import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFocusSession } from "@/hooks/useFocusSession";
import { useUiStore } from "@/stores/uiStore";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function StartSessionModal() {
  const { t } = useTranslation();
  const { isStartModalOpen, setStartModalOpen } = useUiStore();
  const { startSession } = useFocusSession();
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    try {
      await startSession(label.trim() || undefined);
      setLabel("");
      setStartModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setLabel("");
      setStartModalOpen(false);
    }
  };

  return (
    <Dialog open={isStartModalOpen} onClose={handleClose}>
      <DialogHeader>
        <DialogTitle>{t("dashboard.modal.start_title")}</DialogTitle>
        <DialogClose onClose={handleClose} />
      </DialogHeader>

      <Input
        placeholder={t("dashboard.modal.label_placeholder")}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleStart()}
        autoFocus
        disabled={loading}
      />
      <p className="mt-1.5 text-xs text-muted-foreground">
        {t("dashboard.modal.label_hint")}
      </p>

      <DialogFooter>
        <Button variant="outline" onClick={handleClose} disabled={loading}>
          {t("common.cancel")}
        </Button>
        <Button onClick={handleStart} disabled={loading}>
          {loading ? t("common.loading") : t("dashboard.session.start_button")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { pomodoroService } from "@/services/tauri";
import type { PomodoroState } from "@/types";

interface PomodoroStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStarted: (state: PomodoroState) => void;
}

export function PomodoroStartDialog({
  open,
  onOpenChange,
  onStarted,
}: PomodoroStartDialogProps) {
  const { t } = useTranslation(undefined, { keyPrefix: "pomodoro" });
  const [label, setLabel] = useState("");

  const start = async () => {
    const state = await pomodoroService.start({
      label: label.trim() || null,
      checklist_item_id: null,
    });
    onStarted(state);
    onOpenChange(false);
    setLabel("");
  };

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)}>
      <DialogHeader>
        <DialogTitle>{t("start_dialog.title")}</DialogTitle>
      </DialogHeader>
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={t("start_dialog.label_placeholder")}
      />
      <DialogFooter>
        <Button type="button" variant="brand" onClick={() => void start()}>
          {t("controls.start")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

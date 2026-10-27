import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HabitLogForm } from "@/components/features/habits/HabitLogForm";
import type { Habit, HabitLogInput, HabitTargetProgress } from "@/types";
import { useTranslation } from "react-i18next";

export function HabitLogDialog({
  open,
  habit,
  progress,
  onClose,
  onSubmit,
  initialLoggedAt,
  initialNote,
  initialValues,
}: {
  open: boolean;
  habit: Habit | null;
  progress?: HabitTargetProgress[];
  onClose: () => void;
  onSubmit: (input: HabitLogInput) => Promise<void>;
  initialLoggedAt?: number;
  initialNote?: string | null;
  initialValues?: { target_id: string; value: number }[];
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });
  if (!habit) return null;
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>{t("log_title")}</DialogTitle>
      </DialogHeader>
      <HabitLogForm
        habit={habit}
        progress={progress}
        source="dialog"
        onCancel={onClose}
        initialLoggedAt={initialLoggedAt}
        initialNote={initialNote}
        initialValues={initialValues}
        onSubmit={onSubmit}
      />
    </Dialog>
  );
}

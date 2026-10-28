import { useTranslation } from "react-i18next";
import { AnchoredPanel } from "@/components/ui/popover";
import { PopIn } from "@/components/ui/motion";
import { HabitLogForm } from "@/components/features/habits/HabitLogForm";
import type { Habit, HabitLogInput, HabitTargetProgress } from "@/types";

/** Quick-log panel anchored to the button that opened it. Wrap in AnimatePresence for the exit. */
export function HabitLogPopover({
  anchor,
  habit,
  progress,
  onClose,
  onSubmit,
}: {
  anchor: HTMLElement;
  habit: Habit;
  progress?: HabitTargetProgress[];
  onClose: () => void;
  onSubmit: (input: HabitLogInput) => Promise<void>;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });
  return (
    <AnchoredPanel anchor={anchor} onClose={onClose} ariaLabel={t("log_title")} className="w-[22rem] max-w-[calc(100vw-1rem)]">
      <PopIn>
        <HabitLogForm
          habit={habit}
          progress={progress}
          source="card"
          onCancel={onClose}
          onSubmit={onSubmit}
        />
      </PopIn>
    </AnchoredPanel>
  );
}

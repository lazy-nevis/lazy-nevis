import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Popover } from "@/components/ui/popover";
import { HABIT_ICON_IDS, habitIcon } from "@/components/features/habits/habitIcons";
import { toneStyle, toTone } from "@/utils/tones";
import { cn } from "@/utils/cn";

/** Dropdown grid of large habit icons (4 per row). */
export function HabitIconPicker({
  value,
  tone,
  onChange,
}: {
  value: string;
  tone: string;
  onChange: (icon: string) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });
  const Current = habitIcon(value);
  const currentId = HABIT_ICON_IDS.includes(value) ? value : "target";
  return (
    <Popover
      ariaLabel={t("field_icon")}
      triggerClassName="h-11 w-full justify-between px-2"
      trigger={
        <>
          <span
            className="tone-soft flex h-8 w-8 items-center justify-center rounded-lg"
            style={toneStyle(toTone(tone))}
          >
            <Current className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex-1 truncate text-left text-sm">{t(`icons.${currentId}`)}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
        </>
      }
    >
      {(close) => (
        <div className="grid grid-cols-4 gap-2" role="listbox" aria-label={t("field_icon")}>
          {HABIT_ICON_IDS.map((id) => {
            const Icon = habitIcon(id);
            const selected = id === value;
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={t(`icons.${id}`)}
                title={t(`icons.${id}`)}
                onClick={() => {
                  onChange(id);
                  close();
                }}
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-xl border transition-colors",
                  selected
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-6 w-6" aria-hidden />
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
}

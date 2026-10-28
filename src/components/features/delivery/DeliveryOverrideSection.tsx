import { useTranslation } from "react-i18next";
import { BellRing } from "lucide-react";
import { ChannelPicker, type ChannelPickerProps } from "@/components/features/delivery/ChannelPicker";
import { cn } from "@/utils/cn";

/** Shared "Delivery" block for reminder/habit editors: default vs custom channels. */
export function DeliveryOverrideSection({
  custom,
  onCustomChange,
  ...picker
}: {
  custom: boolean;
  onCustomChange: (custom: boolean) => void;
} & Omit<ChannelPickerProps, "label" | "bare">) {
  const { t } = useTranslation(undefined, { keyPrefix: "delivery.override" });
  return (
    <section className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-sm font-semibold">{t("title")}</p>
            <p className="text-xs text-muted-foreground">
              {custom ? t("custom_hint") : t("default_hint")}
            </p>
          </div>
        </div>
        <div className="inline-flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label={t("title")}>
          {([false, true] as const).map((mode) => (
            <button
              key={String(mode)}
              type="button"
              role="radio"
              aria-checked={custom === mode}
              onClick={() => onCustomChange(mode)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                custom === mode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {mode ? t("custom") : t("default")}
            </button>
          ))}
        </div>
      </div>
      {custom && <ChannelPicker {...picker} bare />}
    </section>
  );
}

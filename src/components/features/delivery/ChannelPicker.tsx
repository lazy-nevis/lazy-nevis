import { Bell, Maximize, Volume2, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { AlertChannels } from "@/types";
import { deliveryService } from "@/services/tauri";
import { cn } from "@/utils/cn";

export interface ChannelPickerProps {
  label?: string;
  channels: AlertChannels;
  sound: string;
  onChannelsChange: (channels: AlertChannels) => void;
  onSoundChange: (sound: string) => void;
  testKind: "reminder" | "habit" | "pomodoro";
  builtinSounds: string[];
  disabled?: boolean;
  /** Drop the outer card when nested inside another section. */
  bare?: boolean;
}

/** `builtin:<file>` value for a sound id, whether or not it already carries the prefix. */
export function builtinSoundValue(item: string): string {
  return item.startsWith("builtin:") ? item.replace(/^(builtin:)+/, "builtin:") : `builtin:${item}`;
}

const CHANNEL_ICONS: Record<keyof AlertChannels, LucideIcon> = {
  notification: Bell,
  fullscreen: Maximize,
  sound: Volume2,
};

export function ChannelPicker({
  label,
  channels,
  sound,
  onChannelsChange,
  onSoundChange,
  testKind,
  builtinSounds,
  disabled,
  bare,
}: ChannelPickerProps) {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: "delivery" });
  const currentSound = sound.startsWith("builtin:") ? builtinSoundValue(sound) : sound;
  const soundOptions = [...new Set([...builtinSounds.map(builtinSoundValue), ...(currentSound ? [currentSound] : [])])];
  const soundLabel = (value: string) => {
    const file = value.replace(/^builtin:/, "").split("/").pop() ?? value;
    const key = `settings.audio.builtin_${file.replace(/\.[^.]+$/, "")}`;
    return i18n.exists(key) ? i18n.t(key) : file;
  };

  const toggle = (key: keyof AlertChannels) => {
    onChannelsChange({ ...channels, [key]: !channels[key] });
  };

  return (
    <div className={cn(!bare && "mb-4 rounded-xl border border-border bg-card p-4")}>
      {label && <p className="mb-3 text-sm font-semibold">{label}</p>}
      <div className="grid grid-cols-3 gap-2">
        {(["notification", "fullscreen", "sound"] as const).map((key) => {
          const Icon = CHANNEL_ICONS[key];
          const on = channels[key];
          return (
            <button
              key={key}
              id={`${testKind}-${key}`}
              type="button"
              role="switch"
              aria-checked={on}
              disabled={disabled}
              onClick={() => toggle(key)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-colors disabled:opacity-50",
                on
                  ? "border-brand/60 bg-brand/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", on ? "text-brand" : "text-muted-foreground")} aria-hidden />
              {t(`channels.${key}`)}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1 space-y-1">
          <label htmlFor={`${testKind}-sound-select`} className="text-xs font-medium text-muted-foreground">
            {t("sound")}
          </label>
          <Select
            id={`${testKind}-sound-select`}
            className="w-full"
            value={currentSound}
            disabled={disabled || !channels.sound}
            onChange={(event) => onSoundChange(event.target.value)}
          >
            {soundOptions.map((value) => (
              <option key={value} value={value}>
                {soundLabel(value)}
              </option>
            ))}
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-2"
          disabled={disabled}
          onClick={() => void deliveryService.test(testKind)}
        >
          <Bell className="h-4 w-4" aria-hidden />
          {t("test")}
        </Button>
      </div>
    </div>
  );
}

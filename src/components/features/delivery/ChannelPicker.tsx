import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AlertChannels } from "@/types";
import { deliveryService } from "@/services/tauri";

export interface ChannelPickerProps {
  label: string;
  channels: AlertChannels;
  sound: string;
  onChannelsChange: (channels: AlertChannels) => void;
  onSoundChange: (sound: string) => void;
  testKind: "reminder" | "habit" | "pomodoro";
  builtinSounds: string[];
  disabled?: boolean;
}

export function ChannelPicker({
  label,
  channels,
  sound,
  onChannelsChange,
  onSoundChange,
  testKind,
  builtinSounds,
  disabled,
}: ChannelPickerProps) {
  const { t } = useTranslation(undefined, { keyPrefix: "delivery" });

  const toggle = (key: keyof AlertChannels, value: boolean) => {
    onChannelsChange({ ...channels, [key]: value });
  };

  return (
    <div className="rounded-lg border p-4 mb-4">
      <p className="text-sm font-semibold mb-3">{label}</p>
      {(["notification", "fullscreen", "sound"] as const).map((key) => (
        <div key={key} className="flex items-center justify-between gap-3 py-1.5">
          <label htmlFor={`${testKind}-${key}`} className="text-sm text-muted-foreground">
            {t(`channels.${key}`)}
          </label>
          <Switch
            id={`${testKind}-${key}`}
            checked={channels[key]}
            disabled={disabled}
            onCheckedChange={(checked) => toggle(key, checked)}
          />
        </div>
      ))}
      <div className="mt-3 space-y-1">
        <label htmlFor={`${testKind}-sound-select`} className="text-xs text-muted-foreground">
          {t("sound")}
        </label>
        <Select
          id={`${testKind}-sound-select`}
          className="w-full"
          value={sound}
          disabled={disabled}
          onChange={(event) => onSoundChange(event.target.value)}
        >
          {builtinSounds.map((item) => (
            <option key={item} value={`builtin:${item}`}>
              {item}
            </option>
          ))}
        </Select>
      </div>
      <div className="mt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={disabled}
          onClick={() => void deliveryService.test(testKind)}
        >
          <Bell className="h-4 w-4" />
          {t("test")}
        </Button>
      </div>
    </div>
  );
}

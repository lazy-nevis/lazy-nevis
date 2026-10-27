import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ChannelPicker } from "@/components/features/delivery/ChannelPicker";
import { MarkdownView } from "@/components/features/reminders/MarkdownView";
import { ScheduleEditor } from "@/components/features/reminders/ScheduleEditor";
import { reminderService } from "@/services/tauri";
import type { AlertChannels, Reminder, ReminderInput, ScheduleInput } from "@/types";
import { TONES, toTone } from "@/utils/tones";
import { emptyRule } from "@/utils/schedule";

export interface ReminderEditorDialogProps {
  open: boolean;
  reminder: Reminder | null;
  initialSchedules?: ScheduleInput[] | null;
  weekStart: 0 | 1;
  locale: string;
  defaultChannels: AlertChannels;
  defaultSound: string;
  builtinSounds: string[];
  onClose: () => void;
  onSaved: () => void;
}

export function ReminderEditorDialog({
  open,
  reminder,
  initialSchedules,
  weekStart,
  locale,
  defaultChannels,
  defaultSound,
  builtinSounds,
  onClose,
  onSaved,
}: ReminderEditorDialogProps) {
  const { t } = useTranslation(undefined, { keyPrefix: "reminders" });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState("sky");
  const [useCustomDelivery, setUseCustomDelivery] = useState(false);
  const [channels, setChannels] = useState<AlertChannels>(defaultChannels);
  const [sound, setSound] = useState(defaultSound);
  const [schedules, setSchedules] = useState<ScheduleInput[]>([
    { rule: emptyRule("daily"), active: true, starts_on: null, ends_on: null },
  ]);
  const [preview, setPreview] = useState(false);
  const [nextPreview, setNextPreview] = useState<number[]>([]);

  useEffect(() => {
    if (!open) return;
    if (reminder) {
      setTitle(reminder.title);
      setBody(reminder.body_md ?? "");
      setTone(reminder.tone);
      setUseCustomDelivery(reminder.channels != null);
      setChannels(reminder.channels ?? defaultChannels);
      setSound(reminder.sound ?? defaultSound);
      setSchedules(
        reminder.schedules.map((s) => ({
          id: s.id,
          rule: s.rule,
          active: s.active,
          starts_on: s.starts_on,
          ends_on: s.ends_on,
        })),
      );
    } else {
      setTitle("");
      setBody("");
      setTone("sky");
      setUseCustomDelivery(false);
      setChannels(defaultChannels);
      setSound(defaultSound);
      setSchedules(
        initialSchedules && initialSchedules.length > 0
          ? initialSchedules
          : [{ rule: emptyRule("daily"), active: true, starts_on: null, ends_on: null }],
      );
    }
  }, [open, reminder, initialSchedules, defaultChannels, defaultSound]);

  useEffect(() => {
    if (!open || schedules.length === 0) return;
    const first = schedules[0];
    void reminderService
      .previewSchedule(first.rule, first.starts_on ?? null, first.ends_on ?? null, 5)
      .then(setNextPreview)
      .catch(() => setNextPreview([]));
  }, [open, schedules]);

  const buildInput = (): ReminderInput => ({
    title: title.trim(),
    body_md: body.trim() ? body : null,
    tone,
    channels: useCustomDelivery ? channels : null,
    sound: useCustomDelivery ? sound : null,
    active: reminder?.active ?? true,
    schedules,
  });

  const save = async () => {
    const input = buildInput();
    if (reminder) {
      await reminderService.update(reminder.id, input);
    } else {
      await reminderService.create(input);
    }
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>
          {reminder ? t("editor.title_edit") : t("editor.title_new")}
        </DialogTitle>
      </DialogHeader>
      <div className="max-h-[70vh] space-y-5 overflow-y-auto px-1">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("editor.title_label")}</label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium">{t("editor.body_label")}</label>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPreview((p) => !p)}>
              {t("editor.preview")}
            </Button>
          </div>
          {preview ? (
            <MarkdownView content={body} className="prose prose-sm dark:prose-invert" />
          ) : (
            <textarea
              className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {TONES.map((item) => (
            <button
              key={item}
              type="button"
              className={`h-8 w-8 rounded-full border-2 ${toTone(tone) === item ? "border-foreground" : "border-transparent"}`}
              style={{ background: `hsl(var(--tone-${item}))` }}
              onClick={() => setTone(item)}
              aria-label={item}
            />
          ))}
        </div>
        <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
          <p className="text-sm font-medium">{t("editor.schedules")}</p>
          {schedules.map((schedule, index) => (
            <ScheduleEditor
              key={schedule.id ?? index}
              value={schedule}
              weekStart={weekStart}
              locale={locale}
              onChange={(value) =>
                setSchedules((current) =>
                  current.map((entry, i) => (i === index ? value : entry)),
                )
              }
              onRemove={
                schedules.length > 1
                  ? () => setSchedules((current) => current.filter((_, i) => i !== index))
                  : undefined
              }
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setSchedules((current) => [
                ...current,
                { rule: emptyRule("daily"), active: true, starts_on: null, ends_on: null },
              ])
            }
          >
            {t("editor.add_schedule")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("editor.next_preview")}</p>
          <ul className="text-xs text-muted-foreground">
            {nextPreview.map((ms) => (
              <li key={ms}>
                {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(
                  new Date(ms),
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t("editor.delivery")}</p>
            <Switch checked={useCustomDelivery} onCheckedChange={setUseCustomDelivery} />
            <span className="text-xs text-muted-foreground">
              {useCustomDelivery ? t("editor.custom") : t("editor.inherit")}
            </span>
          </div>
          {useCustomDelivery && (
            <ChannelPicker
              label={t("editor.delivery")}
              channels={channels}
              sound={sound}
              onChannelsChange={setChannels}
              onSoundChange={setSound}
              testKind="reminder"
              builtinSounds={builtinSounds}
            />
          )}
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>{t("editor.cancel")}</Button>
        <Button type="button" onClick={() => void save()} disabled={!title.trim()}>
          {t("editor.save")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus } from "lucide-react";
import { DeliveryOverrideSection } from "@/components/features/delivery/DeliveryOverrideSection";
import { MarkdownEditor } from "@/components/features/reminders/MarkdownEditor";
import { ScheduleEditor } from "@/components/features/reminders/ScheduleEditor";
import { reminderService } from "@/services/tauri";
import type { AlertChannels, Reminder, ReminderInput, ScheduleInput } from "@/types";
import { TONES, toTone } from "@/utils/tones";
import { emptyRule } from "@/utils/schedule";
import { cn } from "@/utils/cn";

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
    <Dialog open={open} onClose={onClose} className="max-w-xl">
      <DialogHeader>
        <DialogTitle>
          {reminder ? t("editor.title_edit") : t("editor.title_new")}
        </DialogTitle>
      </DialogHeader>
      <ScrollArea viewportClassName="max-h-[72vh]" contentClassName="space-y-4 px-0.5">
        <div className="space-y-1.5">
          <label htmlFor="reminder-title" className="text-sm font-medium">{t("editor.title_label")}</label>
          <Input id="reminder-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">{t("editor.body_label")}</span>
          <MarkdownEditor value={body} onChange={setBody} label={t("editor.body_label")} />
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">{t("editor.tone")}</span>
          <div className="flex flex-wrap gap-2">
            {TONES.map((item) => (
              <button
                key={item}
                type="button"
                className={cn(
                  "h-7 w-7 rounded-full border-2 transition-transform",
                  toTone(tone) === item ? "scale-110 border-foreground" : "border-transparent",
                )}
                style={{ background: `hsl(var(--tone-${item}))` }}
                onClick={() => setTone(item)}
                aria-label={item}
                aria-pressed={toTone(tone) === item}
              />
            ))}
          </div>
        </div>
        <section className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{t("editor.schedules")}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() =>
                setSchedules((current) => [
                  ...current,
                  { rule: emptyRule("daily"), active: true, starts_on: null, ends_on: null },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t("editor.add_schedule")}
            </Button>
          </div>
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
          {nextPreview.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{t("editor.next_preview")}</p>
              <div className="flex flex-wrap gap-1.5">
                {nextPreview.map((ms) => (
                  <span
                    key={ms}
                    className="rounded-md bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground ring-1 ring-border"
                  >
                    {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(
                      new Date(ms),
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
        <DeliveryOverrideSection
          custom={useCustomDelivery}
          onCustomChange={setUseCustomDelivery}
          channels={channels}
          sound={sound}
          onChannelsChange={setChannels}
          onSoundChange={setSound}
          testKind="reminder"
          builtinSounds={builtinSounds}
        />
      </ScrollArea>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>{t("editor.cancel")}</Button>
        <Button type="button" onClick={() => void save()} disabled={!title.trim()}>
          {t("editor.save")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

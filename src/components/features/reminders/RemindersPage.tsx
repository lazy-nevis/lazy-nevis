import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityList } from "@/components/features/reminders/ActivityList";
import { ReminderEditorDialog } from "@/components/features/reminders/ReminderEditorDialog";
import { ReminderList } from "@/components/features/reminders/ReminderList";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useSettings } from "@/hooks/useSettings";
import { audioService, reminderService } from "@/services/tauri";
import type { Reminder, TriggerEvent } from "@/types";

type Filter = "all" | "active" | "paused" | "finished";

export function Reminders() {
  const { t } = useTranslation(undefined, { keyPrefix: "reminders" });
  const { settings } = useSettings();
  const [items, setItems] = useState<Reminder[]>([]);
  const [events, setEvents] = useState<TriggerEvent[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [selected, setSelected] = useState<Reminder | null>(null);
  const [builtinSounds, setBuiltinSounds] = useState<string[]>([]);

  const reload = useCallback(async () => {
    const [nextItems, nextEvents] = await Promise.all([
      reminderService.list(),
      reminderService.listEvents(50),
    ]);
    setItems(nextItems);
    setEvents(nextEvents);
  }, []);

  useEffect(() => {
    void reload();
    void audioService.listBuiltin().then(setBuiltinSounds).catch(() => setBuiltinSounds([]));
    let unlisten: (() => void) | undefined;
    void listen("reminders:changed", () => {
      void reload();
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [reload]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const finished = item.finished_at != null;
      if (filter === "finished") return finished;
      if (filter === "active") return item.active && !finished;
      if (filter === "paused") return !item.active && !finished;
      return true;
    });
  }, [items, filter]);

  const weekStart = settings.general.week_start ?? 1;

  const filterOptions = (["all", "active", "paused", "finished"] as Filter[]).map((key) => ({
    value: key,
    label: t(`filter_${key}`),
  }));

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button type="button" variant="brand" onClick={() => { setSelected(null); setEditorOpen(true); }}>
            {t("add")}
          </Button>
        }
      />

      <SegmentedControl
        aria-label={t("title")}
        value={filter}
        onChange={setFilter}
        options={filterOptions}
      />

      <ReminderList
        items={filtered}
        weekStart={weekStart}
        locale={settings.general.language}
        onSelect={(item) => {
          setSelected(item);
          setEditorOpen(true);
        }}
        onToggleActive={(item, active) => {
          void reminderService.setActive(item.id, active).then(reload);
        }}
      />

      <SectionCard title={t("activity.title")}>
        <ActivityList
          events={events}
          locale={settings.general.language}
          onDone={(event) => void reminderService.actOnEvent(event.id, "done").then(reload)}
          onSnooze={(event) =>
            void reminderService.actOnEvent(event.id, "snooze", 10).then(reload)
          }
        />
      </SectionCard>

      <ReminderEditorDialog
        open={editorOpen}
        reminder={selected}
        weekStart={weekStart}
        locale={settings.general.language}
        defaultChannels={settings.delivery.reminders}
        defaultSound={settings.delivery.reminder_sound}
        builtinSounds={builtinSounds}
        onClose={() => setEditorOpen(false)}
        onSaved={() => void reload()}
      />
    </PageContainer>
  );
}

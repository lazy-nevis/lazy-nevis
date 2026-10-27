import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ReminderEditorDialog } from "@/components/features/reminders/ReminderEditorDialog";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useSettings } from "@/hooks/useSettings";
import { audioService, calendarService } from "@/services/tauri";
import type { CalendarKind, CalendarRange, CalendarView, ScheduleInput } from "@/types";
import { CalendarSettingsPanel } from "./CalendarSettings";
import { DayPanel } from "./DayPanel";
import { DayTimeGrid } from "./DayTimeGrid";
import { KindFilter } from "./KindFilter";
import { MonthGrid } from "./MonthGrid";
import { WeekGrid } from "./WeekGrid";
import {
  defaultReminderOnceAt,
  monthGrid,
  rangeForView,
  shiftAnchor,
  toDateKey,
} from "./calendarMath";

export function Calendar() {
  const navigate = useNavigate();
  const { t } = useTranslation(undefined, { keyPrefix: "calendar" });
  const { settings, saveSettings } = useSettings();
  const weekStart = settings.general.week_start as 0 | 1;
  const [view, setView] = useState<CalendarView>(settings.calendar.default_view);
  const [anchor, setAnchor] = useState(() => new Date());
  const [range, setRange] = useState<CalendarRange | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(toDateKey(new Date()));
  const [panelOpen, setPanelOpen] = useState(true);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [initialSchedules, setInitialSchedules] = useState<ScheduleInput[] | null>(null);
  const [builtinSounds, setBuiltinSounds] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  const visibleKinds = settings.calendar.visible_kinds;

  const { fromMs, toMs } = useMemo(
    () => rangeForView(view, anchor, weekStart),
    [view, anchor, weekStart],
  );

  const loadRange = useCallback(async () => {
    setLoading(true);
    try {
      const data = await calendarService.getRange(fromMs, toMs, visibleKinds);
      setRange(data);
    } finally {
      setLoading(false);
    }
  }, [fromMs, toMs, visibleKinds]);

  useEffect(() => {
    void loadRange();
  }, [loadRange]);

  useEffect(() => {
    if (view === "day") {
      setSelectedDate(toDateKey(anchor));
    }
  }, [view, anchor]);

  useEffect(() => {
    void audioService.listBuiltin().then(setBuiltinSounds).catch(() => setBuiltinSounds([]));
  }, []);

  const grid = useMemo(() => monthGrid(anchor, weekStart), [anchor, weekStart]);
  const entries = range?.entries ?? [];
  const days = range?.days ?? [];

  const persistKinds = (kinds: CalendarKind[]) => {
    saveSettings(
      { ...settings, calendar: { ...settings.calendar, visible_kinds: kinds } },
      { silent: true },
    );
  };

  const persistView = (next: CalendarView) => {
    setView(next);
    saveSettings(
      { ...settings, calendar: { ...settings.calendar, default_view: next } },
      { silent: true },
    );
  };

  const openHistorySession = (sessionId: string) => {
    navigate(`/history?session=${encodeURIComponent(sessionId)}`);
  };

  const openNewReminder = () => {
    const dateKey = selectedDate ?? toDateKey(anchor);
    const at = defaultReminderOnceAt(dateKey);
    setInitialSchedules([
      { rule: { kind: "once", at }, active: true, starts_on: null, ends_on: null },
    ]);
    setReminderOpen(true);
  };

  const headerLabel = useMemo(() => {
    if (view === "month") {
      return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }
    if (view === "week") {
      return t("week_of", { date: toDateKey(anchor) });
    }
    return selectedDate ?? toDateKey(anchor);
  }, [anchor, selectedDate, t, view]);

  return (
    <PageContainer className="!max-w-none">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          <PageHeader
            title={t("title")}
            description={t("description")}
            actions={
              <Button type="button" variant="outline" size="sm" onClick={() => setShowSettings((v) => !v)}>
                {t("settings_toggle")}
              </Button>
            }
          />
          {showSettings && (
            <CalendarSettingsPanel
              settings={settings.calendar}
              onChange={(calendar) =>
                saveSettings({ ...settings, calendar }, { silent: true })
              }
            />
          )}
          <SectionCard
            title={headerLabel}
            actions={
              <SegmentedControl
                aria-label={t("view_label")}
                value={view}
                onChange={(v) => persistView(v as CalendarView)}
                options={[
                  { value: "month", label: t("views.month") },
                  { value: "week", label: t("views.week") },
                  { value: "day", label: t("views.day") },
                ]}
              />
            }
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setAnchor((a) => shiftAnchor(a, view, -1))}
                aria-label={t("prev")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
                {t("today")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setAnchor((a) => shiftAnchor(a, view, 1))}
                aria-label={t("next")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <KindFilter visible={visibleKinds} onChange={persistKinds} />
          </SectionCard>
          {loading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
          {view === "month" && (
            <MonthGrid
              grid={grid}
              days={days}
              entries={entries}
              visibleKinds={visibleKinds}
              weekStart={weekStart}
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setPanelOpen(true);
              }}
            />
          )}
          {view === "week" && (
            <WeekGrid
              anchor={anchor}
              weekStart={weekStart}
              entries={entries}
              visibleKinds={visibleKinds}
              selectedDate={selectedDate}
              locale={settings.general.language}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setPanelOpen(true);
              }}
              onSessionClick={openHistorySession}
            />
          )}
          {view === "day" && selectedDate && (
            <DayTimeGrid
              dateKey={selectedDate}
              entries={entries}
              visibleKinds={visibleKinds}
              locale={settings.general.language}
              onSessionClick={openHistorySession}
            />
          )}
        </div>
        {panelOpen && selectedDate && (
          <DayPanel
            dateKey={selectedDate}
            entries={entries}
            visibleKinds={visibleKinds}
            locale={settings.general.language}
            onClose={() => setPanelOpen(false)}
            onSessionClick={openHistorySession}
            onNewReminder={openNewReminder}
          />
        )}
      </div>
      <ReminderEditorDialog
        open={reminderOpen}
        reminder={null}
        initialSchedules={initialSchedules}
        weekStart={weekStart}
        locale={settings.general.language}
        defaultChannels={settings.delivery.reminders}
        defaultSound={settings.delivery.reminder_sound}
        builtinSounds={builtinSounds}
        onClose={() => {
          setReminderOpen(false);
          setInitialSchedules(null);
        }}
        onSaved={() => {
          setReminderOpen(false);
          setInitialSchedules(null);
          void loadRange();
        }}
      />
    </PageContainer>
  );
}

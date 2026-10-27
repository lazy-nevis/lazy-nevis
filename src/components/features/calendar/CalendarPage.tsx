import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Loader2, Plus, Search, X } from "lucide-react";
import { ReminderEditorDialog } from "@/components/features/reminders/ReminderEditorDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { AnchoredPanel } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useSettings } from "@/hooks/useSettings";
import { audioService, calendarService } from "@/services/tauri";
import type { CalendarKind, CalendarRange, CalendarView, ScheduleInput } from "@/types";
import { DayPanel } from "./DayPanel";
import { DayTimeGrid } from "./DayTimeGrid";
import { KindFilter } from "./KindFilter";
import { MonthGrid } from "./MonthGrid";
import { WeekGrid } from "./WeekGrid";
import {
  defaultReminderOnceAt,
  entryMatchesQuery,
  monthGrid,
  rangeForView,
  shiftAnchor,
  toDateKey,
} from "./calendarMath";

export function Calendar() {
  const navigate = useNavigate();
  const { t } = useTranslation(undefined, { keyPrefix: "calendar" });
  const { t: tKind } = useTranslation(undefined, { keyPrefix: "calendar.kinds" });
  const { settings, saveSettings } = useSettings();
  const weekStart = settings.general.week_start as 0 | 1;
  const [view, setView] = useState<CalendarView>(settings.calendar.default_view);
  const [anchor, setAnchor] = useState(() => new Date());
  const [range, setRange] = useState<CalendarRange | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(toDateKey(new Date()));
  const [dayPopover, setDayPopover] = useState<{ date: string; anchor: HTMLElement } | null>(null);
  const [query, setQuery] = useState("");
  const [reminderOpen, setReminderOpen] = useState(false);
  const [initialSchedules, setInitialSchedules] = useState<ScheduleInput[] | null>(null);
  const [builtinSounds, setBuiltinSounds] = useState<string[]>([]);

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
  const entries = useMemo(
    () => (range?.entries ?? []).filter((entry) => entryMatchesQuery(entry, query, (kind) => tKind(kind))),
    [range, query, tKind],
  );
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
    setDayPopover(null);
    setReminderOpen(true);
  };

  const selectDate = (date: string, anchor: HTMLElement) => {
    setSelectedDate(date);
    setDayPopover((current) => (current?.date === date ? null : { date, anchor }));
  };

  const locale = settings.general.language;
  const headerLabel = useMemo(() => {
    if (view === "month") {
      return anchor.toLocaleDateString(locale, { month: "long", year: "numeric" });
    }
    if (view === "week") {
      const start = new Date(fromMs);
      const end = new Date(toMs);
      const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
      return `${fmt.format(start)} – ${fmt.format(end)}, ${end.getFullYear()}`;
    }
    const [y, m, d] = (selectedDate ?? toDateKey(anchor)).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }, [anchor, fromMs, toMs, locale, selectedDate, view]);

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button type="button" variant="brand" className="gap-2" onClick={openNewReminder}>
            <Plus className="h-4 w-4" aria-hidden />
            {t("new_reminder")}
          </Button>
        }
      />
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-border">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-r-none"
                onClick={() => setAnchor((a) => shiftAnchor(a, view, -1))}
                aria-label={t("prev")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-none border-x border-border px-3"
                onClick={() => {
                  setAnchor(new Date());
                  setSelectedDate(toDateKey(new Date()));
                }}
              >
                {t("today")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-l-none"
                onClick={() => setAnchor((a) => shiftAnchor(a, view, 1))}
                aria-label={t("next")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <h2 className="truncate text-lg font-semibold capitalize tracking-tight">{headerLabel}</h2>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label={t("loading")} />}
          </div>
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
        </div>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("search_placeholder")}
              aria-label={t("search_placeholder")}
              className="pl-9 pr-8"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("search_clear")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <KindFilter visible={visibleKinds} onChange={persistKinds} />
        </div>
      </div>
      {view === "month" && (
        <MonthGrid
          grid={grid}
          days={days}
          entries={entries}
          visibleKinds={visibleKinds}
          weekStart={weekStart}
          selectedDate={selectedDate}
          onSelectDate={selectDate}
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
          onSelectDate={selectDate}
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
      {dayPopover && (
        <AnchoredPanel
          key={dayPopover.date}
          anchor={dayPopover.anchor}
          onClose={() => setDayPopover(null)}
          ariaLabel={dayPopover.date}
        >
          <DayPanel
            dateKey={dayPopover.date}
            entries={entries}
            visibleKinds={visibleKinds}
            locale={settings.general.language}
            onClose={() => setDayPopover(null)}
            onSessionClick={openHistorySession}
            onNewReminder={openNewReminder}
          />
        </AnchoredPanel>
      )}
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

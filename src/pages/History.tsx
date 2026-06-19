import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, Download, ChevronLeft, Clock, Target, Bell, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { sessionService } from "@/services/tauri";
import { useUiStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogHeader, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { formatDate, formatDateTime, formatDurationHuman, formatPercent, formatTime } from "@/utils/formatters";
import { cn } from "@/utils/cn";
import { csvRow } from "@/utils/csv";
import { SessionTimeline } from "@/components/features/SessionTimeline";
import { DonutChart } from "@/components/charts/DonutChart";
import { HourlyBars } from "@/components/charts/HourlyBars";
import { FocusTrend } from "@/components/charts/FocusTrend";
import { ActivityCalendar } from "@/components/charts/ActivityCalendar";
import type { SessionStats, SessionSummary } from "@/types";

type DateFilter = "today" | "week" | "month" | "all";

function getDateRange(filter: DateFilter): [number, number] {
  const now = Date.now();
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  switch (filter) {
    case "today":
      return [start.getTime(), now];
    case "week": {
      const d = new Date(start);
      d.setDate(d.getDate() - d.getDay());
      return [d.getTime(), now];
    }
    case "month": {
      const d = new Date(start);
      d.setDate(1);
      return [d.getTime(), now];
    }
    case "all":
      return [0, now];
  }
}

export function History() {
  const { t, i18n } = useTranslation();
  const { addToast } = useUiStore();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DateFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<SessionStats | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [clearAll, setClearAll] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const [from, to] = getDateRange(filter);
      const data =
        filter === "all"
          ? await sessionService.list(100, 0)
          : await sessionService.listByRange(from, to);
      setSessions(data);
    } catch {
      addToast(t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  }, [filter, addToast, t]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleOpenDetail = async (id: string) => {
    try {
      const detail = await sessionService.getDetail(id);
      setSelected(detail);
    } catch {
      addToast(t("common.error"), "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await sessionService.delete(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setDeleteTarget(null);
      addToast(t("history.session_deleted"));
    } catch {
      addToast(t("common.error"), "error");
    }
  };

  const handleClearAll = async () => {
    try {
      await sessionService.clearAll();
      setSessions([]);
      setClearAll(false);
      addToast(t("history.all_cleared"));
    } catch {
      addToast(t("common.error"), "error");
    }
  };

  const handleExportJson = (stats: SessionStats) => {
    const blob = new Blob([JSON.stringify(stats, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lazynevis-session-${stats.session.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = (stats: SessionStats) => {
    const headers = "id,event_type,app_name,window_title,started_at,ended_at,duration_ms,is_distraction\n";
    const rows = stats.events
      .map((e) =>
        csvRow([
          e.id,
          e.event_type,
          e.app_name,
          e.window_title,
          e.started_at,
          e.ended_at ?? "",
          e.duration_ms ?? "",
          e.is_distraction ? 1 : 0,
        ])
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lazynevis-session-${stats.session.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAllCsv = () => {
    if (sessions.length === 0) return;
    const visible = sessions.filter((s) => {
      if (!searchQuery) return true;
      return s.label?.toLowerCase().includes(searchQuery.toLowerCase());
    });
    const headers =
      "session_id,session_label,started_at,ended_at,total_focus_ms,total_distracted_ms,total_idle_ms,total_alerts,focus_percent\n";
    const rows = visible
      .map((s) =>
        csvRow([
          s.id,
          s.label,
          s.started_at,
          s.ended_at ?? "",
          s.total_focus_ms,
          s.total_distracted_ms,
          s.total_idle_ms,
          s.total_alerts,
          s.focus_percent.toFixed(1),
        ])
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lazynevis-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (selected) {
    return (
      <DetailView
        stats={selected}
        onBack={() => setSelected(null)}
        onExportJson={handleExportJson}
        onExportCsv={handleExportCsv}
        locale={i18n.language}
        t={t}
      />
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("history.title")}</h1>
        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExportAllCsv}
              title={t("history.export.sensitive_warning")}
            >
              <Download className="h-4 w-4" />
              {t("history.export.csv")}
            </Button>
          )}
          {sessions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive gap-1.5"
              onClick={() => setClearAll(true)}
            >
              <Trash2 className="h-4 w-4" />
              {t("history.clear_confirm").split("?")[0]}?
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(["today", "week", "month", "all"] as DateFilter[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {t(`history.filters.${f}`)}
          </Button>
        ))}
      </div>

      {/* Search by label */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9 pr-8 text-sm"
          placeholder={t("history.search_placeholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            aria-label={t("history.clear_search")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Overview charts (only when not filtered to a specific day) */}
      {!loading && sessions.length >= 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <FocusTrend
                sessions={sessions}
                locale={i18n.language}
                title={t("dashboard.charts.focus_trend")}
                emptyLabel={t("dashboard.charts.no_data")}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <ActivityCalendar
                sessions={sessions}
                locale={i18n.language}
                title={t("dashboard.charts.activity_calendar")}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Session list */}
      {loading ? (
        <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
      ) : sessions.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">{t("history.empty")}</p>
      ) : (
        <div className="space-y-2">
          {sessions
            .filter((s) => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              return (
                s.label?.toLowerCase().includes(q)
              );
            })
            .map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              locale={i18n.language}
              onOpen={() => handleOpenDetail(session.id)}
              onDelete={() => setDeleteTarget(session.id)}
            />
          ))}
          {sessions.filter((s) => {
            if (!searchQuery) return false;
            const q = searchQuery.toLowerCase();
            return !s.label?.toLowerCase().includes(q);
          }).length === sessions.length && searchQuery && (
            <p className="text-muted-foreground text-sm py-4 text-center">
              {t("history.no_search_results", { query: searchQuery })}
            </p>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogHeader>
          <DialogTitle>{t("history.delete_confirm")}</DialogTitle>
          <DialogClose onClose={() => setDeleteTarget(null)} />
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Clear all confirmation */}
      <Dialog open={clearAll} onClose={() => setClearAll(false)}>
        <DialogHeader>
          <DialogTitle>{t("history.clear_confirm")}</DialogTitle>
          <DialogClose onClose={() => setClearAll(false)} />
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setClearAll(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" onClick={handleClearAll}>
            {t("common.confirm")}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function SessionCard({
  session,
  locale,
  onOpen,
  onDelete,
}: {
  session: SessionSummary;
  locale: string;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const total = session.total_focus_ms + session.total_distracted_ms + session.total_idle_ms;
  const { t } = useTranslation();

  const startTime = formatTime(session.started_at, locale);
  const endTime = session.ended_at ? formatTime(session.ended_at, locale) : null;
  const dateStr = formatDate(session.started_at, locale);

  return (
    <Card
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onOpen}
    >
      <CardContent className="py-3.5 px-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Header row: label + date/time */}
            <div className="flex items-baseline gap-2 flex-wrap mb-1">
              {session.label && (
                <span className="font-semibold truncate">{session.label}</span>
              )}
              <span className="text-xs text-muted-foreground">
                {dateStr} · {startTime}{endTime ? ` → ${endTime}` : ""}
              </span>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Duration */}
              <span className="flex items-center gap-1 text-xs text-muted-foreground" title={t("history.session_card.duration")}>
                <Clock className="h-3 w-3" />
                {total > 0 ? formatDurationHuman(total) : "—"}
              </span>
              {/* Focus time */}
              {session.total_focus_ms > 0 && (
                <span className="flex items-center gap-1 text-xs text-green-600" title={t("dashboard.timer.focused")}>
                  <Target className="h-3 w-3" />
                  {formatDurationHuman(session.total_focus_ms)}
                </span>
              )}
              {/* Focus % */}
              <span className={cn("text-xs font-medium", session.focus_percent >= 70 ? "text-green-600" : session.focus_percent >= 40 ? "text-yellow-600" : "text-red-500")} title={t("history.session_card.focus_score")}>
                {formatPercent(session.focus_percent)}
              </span>
              {session.total_alerts > 0 && (
                <span className="flex items-center gap-1 text-xs text-yellow-600" title={t("history.session_card.alerts")}>
                  <Bell className="h-3 w-3" />
                  {session.total_alerts}
                </span>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={t("history.delete_session_label", { label: session.label ?? t("history.untitled_session") })}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailView({
  stats,
  onBack,
  onExportJson,
  onExportCsv,
  locale,
  t,
}: {
  stats: SessionStats;
  onBack: () => void;
  onExportJson: (s: SessionStats) => void;
  onExportCsv: (s: SessionStats) => void;
  locale: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { session, checkpoints } = stats;
  // Use local state for events so flip classification triggers a full re-render
  const [events, setEvents] = useState(stats.events);
  const total = session.total_focus_ms + session.total_distracted_ms + session.total_idle_ms;

  // Top apps by time — recomputed when events change (after flip)
  const topApps = useMemo(() => {
    const appTimes: Record<string, number> = {};
    for (const ev of events) {
      if (ev.app_name && ev.duration_ms) {
        appTimes[ev.app_name] = (appTimes[ev.app_name] ?? 0) + ev.duration_ms;
      }
    }
    return Object.entries(appTimes).sort(([, a], [, b]) => b - a).slice(0, 8);
  }, [events]);

  return (
    <div className="flex h-full flex-col gap-4 p-6 overflow-y-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="h-4 w-4" />
          {t("history.title")}
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onExportJson(stats)} className="gap-1.5">
            <Download className="h-4 w-4" />
            JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExportCsv(stats)} className="gap-1.5">
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("history.export.sensitive_warning")}</p>

      {/* Stats — more detail */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("history.session_card.duration")} value={total > 0 ? formatDurationHuman(total) : "—"} />
        <StatCard label={t("dashboard.timer.focused")} value={formatDurationHuman(session.total_focus_ms)} green />
        <StatCard label={t("dashboard.timer.distracted")} value={formatDurationHuman(session.total_distracted_ms)} />
        <StatCard label={t("dashboard.timer.idle")} value={formatDurationHuman(session.total_idle_ms)} />
        <StatCard
          label={t("history.session_card.focus_score")}
          value={formatPercent((session.total_focus_ms / Math.max(total, 1)) * 100)}
          green
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground mb-0.5">{t("history.detail.started")}</p>
          <p className="font-medium">{formatDateTime(session.started_at, locale)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground mb-0.5">{t("history.detail.ended")}</p>
          <p className="font-medium">{session.ended_at ? formatDateTime(session.ended_at, locale) : "—"}</p>
        </div>
        <StatCard label={t("history.session_card.alerts")} value={String(session.total_alerts)} />
        <StatCard label={t("history.detail.checkpoints")} value={String(checkpoints.length)} />
      </div>

      {/* Charts row */}
      {topApps.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Donut: app distribution */}
          <Card>
            <CardContent className="pt-4 flex justify-center">
              <DonutChart
                title={t("dashboard.charts.app_distribution")}
                emptyLabel={t("dashboard.charts.no_data")}
                data={topApps.map(([app, ms], i) => ({
                  label: app,
                  value: ms,
                  color: [
                    "#22c55e","#3b82f6","#a855f7","#f59e0b","#ef4444",
                    "#06b6d4","#84cc16","#f97316",
                  ][i % 8],
                }))}
              />
            </CardContent>
          </Card>

          {/* Hourly bars */}
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <HourlyBars
                events={events}
                sessionStart={session.started_at}
                sessionEnd={session.ended_at ?? Date.now()}
                title={t("dashboard.charts.hourly_breakdown")}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Visual + Written Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("history.detail.events")}</CardTitle>
        </CardHeader>
        <CardContent>
          <SessionTimeline
            events={events}
            checkpoints={checkpoints}
            sessionStart={session.started_at}
            sessionEnd={session.ended_at ?? Date.now()}
            locale={locale}
            onFlipClassification={async (eventId, isDistraction) => {
              // Optimistic update — full re-render of charts/timeline
              setEvents((prev) =>
                prev.map((ev) =>
                  ev.id === eventId ? { ...ev, is_distraction: isDistraction } : ev
                )
              );
              // Persist to DB
              await sessionService.updateEventClassification(eventId, isDistraction);
            }}
          />
        </CardContent>
      </Card>

      {/* Raw event list (collapsible) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">{t("history.detail.all_events")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {events.map((ev) => (
              <div
                key={ev.id}
                className={cn(
                  "flex items-center gap-3 text-xs py-1 border-b border-border/50",
                  ev.is_distraction && "text-red-600 dark:text-red-400"
                )}
              >
                <span className="text-muted-foreground font-mono tabular-nums shrink-0 w-16">
                  {formatTime(ev.started_at, locale)}
                </span>
                <span className="text-muted-foreground shrink-0 w-20 truncate">{ev.event_type.replace("_", " ")}</span>
                <span className="flex-1 truncate">{ev.app_name}</span>
                {ev.duration_ms && (
                  <span className="text-muted-foreground shrink-0">
                    {formatDurationHuman(ev.duration_ms)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <Card>
      <CardContent className="py-4 px-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={cn("text-lg font-bold tabular-nums", green && "text-green-600")}>{value}</p>
      </CardContent>
    </Card>
  );
}

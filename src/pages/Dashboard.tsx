import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Play, Square, Pause, Flag, AlertCircle, Monitor } from "lucide-react";
import { useFocusSession } from "@/hooks/useFocusSession";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { sessionService } from "@/services/tauri";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StartSessionModal } from "@/components/features/StartSessionModal";
import { formatDuration, formatDurationHuman, formatDateTime, formatPercent } from "@/utils/formatters";
import { cn } from "@/utils/cn";
import type { SessionSummary } from "@/types";

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const { activeSession, liveStats, checkpoints, isActive, hydrationStatus, refreshSession, pauseSession, stopSession, addCheckpoint } =
    useFocusSession();
  const isOnBreak = useSessionStore((s) => s.isOnBreak);
  const breakStartedAt = useSessionStore((s) => s.breakStartedAt);
  const breakReminderPending = useSessionStore((s) => s.breakReminderPending);
  const breakDurationMs = useSettingsStore((s) => s.settings.breaks.break_duration_ms);
  const { setStartModalOpen } = useUiStore();

  const [checkpointLabel, setCheckpointLabel] = useState("");
  const [lastSession, setLastSession] = useState<SessionSummary | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  useEffect(() => {
    if (!isActive) {
      sessionService
        .list(1, 0)
        .then((sessions) => setLastSession(sessions[0] ?? null))
        .catch(() => {});
    }
  }, [isActive]);

  const handleAddCheckpoint = async () => {
    await addCheckpoint(checkpointLabel.trim() || undefined);
    setCheckpointLabel("");
  };

  const handleStop = async () => {
    if (!confirmStop) {
      setConfirmStop(true);
      setTimeout(() => setConfirmStop(false), 3000);
      return;
    }
    setConfirmStop(false);
    await stopSession();
  };

  const focusMs = liveStats?.focus_ms ?? 0;
  const distractedMs = liveStats?.distracted_ms ?? 0;
  const idleMs = liveStats?.idle_ms ?? 0;
  const focusPercent = liveStats?.focus_percent ?? 100;
  const isDistracted = liveStats?.is_distracted ?? false;
  const isIdle = liveStats?.is_idle ?? false;
  const isPaused = liveStats?.is_paused ?? false;
  const elapsed = liveStats?.total_ms ?? 0;

  if (hydrationStatus === "loading") {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  if (hydrationStatus === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">{t("dashboard.session.sync_error")}</p>
        <Button variant="outline" onClick={() => void refreshSession()}>{t("dashboard.session.try_again")}</Button>
      </div>
    );
  }

  if (!isActive) {
    return (
      <>
        <StartSessionModal />
        <div className="flex h-full flex-col items-center justify-center gap-8 p-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.session.no_session_title")}</h1>
            <p className="mt-2 text-muted-foreground max-w-sm">
              {t("dashboard.session.no_session_description")}
            </p>
          </div>

          <Button size="lg" onClick={() => setStartModalOpen(true)} className="gap-2 text-base px-8">
            <Play className="h-5 w-5" />
            {t("dashboard.session.start_button")}
          </Button>

          {lastSession && (
            <Card className="w-full max-w-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-normal">
                  {t("dashboard.session.last_session")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {lastSession.label && (
                  <p className="font-medium">{lastSession.label}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(lastSession.started_at, i18n.language)}
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-sm">
                    {formatDurationHuman(lastSession.total_focus_ms + lastSession.total_distracted_ms + lastSession.total_idle_ms)}
                  </span>
                  <Badge variant="success">{formatPercent(lastSession.focus_percent)} focus</Badge>
                  {lastSession.total_alerts > 0 && (
                    <Badge variant="warning">{lastSession.total_alerts} alerts</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {!lastSession && (
            <p className="text-sm text-muted-foreground">{t("dashboard.session.no_sessions_yet")}</p>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6 overflow-y-auto">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "h-3 w-3 rounded-full transition-colors",
              isPaused
                ? "bg-yellow-500"
                : isIdle
                ? "bg-blue-400"
                : isDistracted
                ? "bg-red-500 animate-pulse"
                : "bg-green-500 animate-pulse"
            )}
          />
          <span className="font-semibold">
            {isPaused
              ? t("dashboard.session.status_paused")
              : isDistracted
              ? t("dashboard.session.status_distracted")
              : t("dashboard.session.status_focused")}
          </span>
          {activeSession?.label && (
            <Badge variant="outline" className="text-xs">
              {activeSession.label}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={pauseSession}
            className="gap-1.5"
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {isPaused ? t("dashboard.session.resume_button") : t("dashboard.session.pause_button")}
          </Button>

          <Button
            variant={confirmStop ? "destructive" : "outline"}
            size="sm"
            onClick={handleStop}
            className="gap-1.5"
          >
            <Square className="h-4 w-4" />
            {confirmStop ? t("common.confirm") : t("dashboard.session.stop_button")}
          </Button>
        </div>
      </div>

      {breakReminderPending && !isOnBreak && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm font-semibold">{t("dashboard.break.reminder")}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => useSessionStore.getState().setBreakReminderPending(false)}>
              {t("dashboard.break.skip")}
            </Button>
            <Button size="sm" variant="success" onClick={async () => {
              await sessionService.startBreak();
              useSessionStore.getState().setOnBreak(true);
            }}>
              {t("dashboard.break.start")}
            </Button>
          </div>
        </div>
      )}

      {/* Break banner */}
      {isOnBreak && (
        <BreakBanner
          startedAt={breakStartedAt}
          breakDurationMs={breakDurationMs}
          onEndBreak={async () => {
            useSessionStore.getState().setOnBreak(false);
            await sessionService.endBreak().catch(() => {});
          }}
          t={t}
        />
      )}

      {/* Timer grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <TimerCard label={t("dashboard.timer.total")} value={formatDuration(elapsed)} variant="default" />
        <TimerCard label={t("dashboard.timer.focused")} value={formatDuration(focusMs)} variant="success" />
        <TimerCard label={t("dashboard.timer.distracted")} value={formatDuration(distractedMs)} variant="danger" />
        <TimerCard label={t("dashboard.timer.idle")} value={formatDuration(idleMs)} variant="idle" />
        <TimerCard
          label={t("dashboard.timer.focus_score")}
          value={formatPercent(focusPercent)}
          variant={focusPercent >= 70 ? "success" : focusPercent >= 40 ? "warning" : "danger"}
        />
      </div>

      {/* Current window */}
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t("dashboard.current_window.label")}</p>
            <p className={cn("text-sm font-medium truncate", isDistracted && "text-red-500")}>
              {liveStats?.current_app ?? t("dashboard.current_window.none")}
            </p>
          </div>
          {liveStats?.alert_count ? (
            <Badge variant="warning" className="ml-auto shrink-0 gap-1">
              <AlertCircle className="h-3 w-3" />
              {liveStats.alert_count}
            </Badge>
          ) : null}
        </CardContent>
      </Card>

      {/* Checkpoints */}
      <Card className="flex-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("dashboard.checkpoints.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder={t("dashboard.checkpoints.add_label_placeholder")}
              value={checkpointLabel}
              onChange={(e) => setCheckpointLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCheckpoint()}
              className="text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddCheckpoint}
              className="gap-1.5 shrink-0"
            >
              <Flag className="h-4 w-4" />
              {t("dashboard.session.checkpoint_button")}
            </Button>
          </div>

          {checkpoints.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {t("dashboard.checkpoints.empty")}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {checkpoints.map((cp) => (
                <li key={cp.id} className="flex items-center gap-2 text-sm">
                  <Flag className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(cp.created_at).toLocaleTimeString(i18n.language, {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  {cp.label && <span>{cp.label}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type TimerVariant = "default" | "success" | "danger" | "warning" | "idle";

function TimerCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: TimerVariant;
}) {
  return (
    <Card>
      <CardContent className="py-4 px-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p
          className={cn(
            "text-xl font-mono font-bold tabular-nums",
            variant === "success" && "text-green-600 dark:text-green-400",
            variant === "danger" && "text-red-600 dark:text-red-400",
            variant === "warning" && "text-yellow-600 dark:text-yellow-400",
            variant === "idle" && "text-blue-500 dark:text-blue-400"
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function BreakBanner({
  startedAt,
  breakDurationMs,
  onEndBreak,
  t,
}: {
  startedAt: number | null;
  breakDurationMs: number;
  onEndBreak: () => void;
  t: TFunction;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const update = () => {
      const next = Date.now() - startedAt;
      setElapsed(next);
      if (next >= breakDurationMs) onEndBreak();
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt, breakDurationMs, onEndBreak]);

  return (
    <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-800 px-4 py-3 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-green-800 dark:text-green-200">
          {t("dashboard.break.active", { remaining: formatDuration(Math.max(0, breakDurationMs - elapsed)) })}
        </p>
        <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
          {t("settings.breaks.hint")}
        </p>
      </div>
      <Button size="sm" variant="success" onClick={onEndBreak} className="shrink-0">
        {t("dashboard.break.end")}
      </Button>
    </div>
  );
}

import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import {
  History as HistoryIcon,
  Info,
  ListChecks,
  Maximize2,
  Monitor,
  Pause,
  Pin,
  PinOff,
  Play,
  Settings as SettingsIcon,
  Square,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ChecklistItem } from "@/types";
import { ChecklistSettingsButton } from "@/components/features/checklist/ChecklistSettingsButton";
import { ChecklistGroupedList } from "@/components/features/checklist/ChecklistGroupedList";
import { ChecklistInput } from "@/components/features/checklist/ChecklistInput";
import { HabitCompactList } from "@/components/features/habits/HabitCompactList";
import { PomodoroCompactStrip } from "@/components/features/pomodoro/PomodoroCompactStrip";
import { useChecklist } from "@/hooks/useChecklist";
import { usePomodoro } from "@/hooks/usePomodoro";
import { useSettings } from "@/hooks/useSettings";
import { appModeService, overlayService, sessionService } from "@/services/tauri";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import { formatDuration } from "@/utils/formatters";
import { COMPACT_SEGMENTS, type CompactSegmentId } from "@/config/compactSegments";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/utils/cn";

const compactChromeBtn =
  "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const compactLinkBtn =
  "mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Compact Mode layout — a narrow vertical column. Rendered inside AppShell, so
 * useFocusSession (called once there) keeps feeding the stores; this component
 * only reads stores and invokes commands (same pattern as CloseWarningDialog).
 * Spec: app-modes/switch-to-compact.
 */
export function CompactShell({
  pinned,
  isFullscreen = false,
}: {
  pinned: boolean;
  /** Hides the mode toggle while native fullscreen owns the layout
   * (spec: app-modes/fullscreen-follows-full-mode). */
  isFullscreen?: boolean;
}) {
  const { t } = useTranslation();
  const { activeSession, liveStats, setActiveSession, resetCheckpoints } = useSessionStore();
  const { addToast } = useUiStore();
  const {
    openView,
    graceMs,
    createItem,
    updateItem,
    completeItem,
    uncompleteItem,
    deleteItem,
    previewReorder,
    commitReorder,
    startFocusFromItem,
  } = useChecklist();
  const [name, setName] = useState("");
  const [segment, setSegment] = useState<CompactSegmentId>(COMPACT_SEGMENTS[0]?.id ?? "checklist");
  const [deleteTarget, setDeleteTarget] = useState<ChecklistItem | null>(null);
  const { settings } = useSettings();
  usePomodoro();

  const startSession = async () => {
    try {
      const session = await sessionService.start(name.trim() || undefined);
      setActiveSession(session);
      resetCheckpoints();
      setName("");
    } catch (err) {
      addToast(
        String(err).includes("SessionAlreadyActive")
          ? t("dashboard.session.already_active")
          : t("common.error"),
        "error",
      );
    }
  };

  const stopSession = async () => {
    try {
      await sessionService.stop();
      await overlayService.cancelActive().catch(() => {});
      setActiveSession(null);
      resetCheckpoints();
      addToast(t("dashboard.session.saved"), "success");
    } catch {
      addToast(t("common.error"), "error");
    }
  };

  const isPaused = liveStats?.is_paused ?? false;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top bar — brand logo centered (window-relative, like a native title),
          window controls anchored right. Traffic lights float over the left
          edge on macOS with nothing of ours underneath, so no left gutter is
          needed. Doubles as the drag region under the macOS overlay title bar
          (spec: app-modes/compact-top-bar + custom-title-bar). */}
      <header
        data-tauri-drag-region
        className="relative flex select-none items-center justify-end border-b border-border/60 py-2.5 pr-2"
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <BrandLogo className="h-7" />
        </div>
        <div className="relative flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => void appModeService.setPin(!pinned)}
            title={pinned ? t("app_modes.unpin") : t("app_modes.pin")}
            aria-label={pinned ? t("app_modes.unpin") : t("app_modes.pin")}
            className={cn(compactChromeBtn, pinned && "text-brand")}
          >
            {pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void appModeService.openSecondary("about")}
            title={t("nav.about")}
            aria-label={t("nav.about")}
            className={compactChromeBtn}
          >
            <Info className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void appModeService.openSecondary("settings")}
            title={t("nav.settings")}
            aria-label={t("nav.settings")}
            className={compactChromeBtn}
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
          {/* Hidden in native fullscreen: the OS fullscreen button already
              switches to Full Mode's layout there
              (spec: app-modes/fullscreen-follows-full-mode). */}
          {!isFullscreen && (
            <button
              type="button"
              onClick={() => void appModeService.setMode("full")}
              title={t("app_modes.switch_to_full")}
              aria-label={t("app_modes.switch_to_full")}
              className={compactChromeBtn}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* Session block */}
      <section className="border-b border-border/60 p-3">
        {activeSession ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium">
                {activeSession.label ?? t("notifications.unnamed_session")}
              </p>
              <span className="font-mono text-base font-bold tabular-nums">
                {formatDuration(liveStats?.total_ms ?? 0)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/40 p-2 text-center text-[11px] text-muted-foreground">
              <div>
                <p className="font-mono tabular-nums text-foreground">
                  {formatDuration(liveStats?.focus_ms ?? 0)}
                </p>
                {t("tray_panel.focus")}
              </div>
              <div>
                <p className="font-mono tabular-nums text-foreground">
                  {formatDuration(liveStats?.distracted_ms ?? 0)}
                </p>
                {t("tray_panel.distracted")}
              </div>
              <div>
                <p className="font-mono tabular-nums text-foreground">
                  {formatDuration(liveStats?.idle_ms ?? 0)}
                </p>
                {t("tray_panel.idle")}
              </div>
            </div>
            {liveStats?.current_app && (
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <Monitor className="h-3 w-3 shrink-0" />
                {liveStats.current_app}
              </p>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 gap-1.5"
                onClick={() => void sessionService.pause()}>
                {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                {isPaused ? t("dashboard.session.resume_button") : t("dashboard.session.pause_button")}
              </Button>
              <Button size="sm" variant="destructive" className="flex-1 gap-1.5"
                onClick={() => void stopSession()}>
                <Square className="h-3.5 w-3.5" />
                {t("dashboard.session.stop_button")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void startSession();
              }}
              placeholder={t("tray_panel.session_name_placeholder")}
              className="h-8 text-sm"
            />
            <Button size="sm" variant="brand" className="w-full gap-1.5" onClick={() => void startSession()}>
              <Play className="h-3.5 w-3.5" />
              {t("dashboard.session.start_button")}
            </Button>
          </div>
        )}
        <button
          type="button"
          onClick={() => void appModeService.openSecondary("history")}
          className={compactLinkBtn}
        >
          <HistoryIcon className="h-3.5 w-3.5" />
          {t("app_modes.view_reports")}
        </button>
        <div className="session-extra mt-2">
          <PomodoroCompactStrip />
        </div>
      </section>

      {COMPACT_SEGMENTS.length > 1 && (
        <div className="border-b px-3 py-2">
          <SegmentedControl
            aria-label={t("ui.segment_label")}
            value={segment}
            onChange={setSegment}
            options={COMPACT_SEGMENTS.map((s) => ({
              value: s.id,
              label: t(s.labelKey),
            }))}
          />
        </div>
      )}

      {/* Checklist block (full CRUD, compact rows) */}
      {segment === "checklist" && (
      <section className="flex min-h-0 flex-1 flex-col p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("checklist.open_title")}
          </p>
          <ChecklistSettingsButton secondary />
        </div>
        {/* Scrollbar sits in the section padding; rows keep the block's full width. */}
        <ScrollArea className="min-h-0 flex-1">
          {openView.length === 0 && (
            <EmptyState
              icon={ListChecks}
              title={t("checklist.empty_open")}
              className="border-none bg-transparent py-3 shadow-none"
            />
          )}
          <ChecklistGroupedList
            openView={openView}
            groupBy={settings.checklist.group_by ?? []}
            graceMs={graceMs}
            compact
            categoryFilterIds={[]}
            createItem={createItem}
            onToggleComplete={(item) => void completeItem(item.id)}
            onUndo={(item) => void uncompleteItem(item.id)}
            onUpdate={(item, patch) => void updateItem(item, patch)}
            onDelete={setDeleteTarget}
            onStartFocus={
              activeSession
                ? undefined
                : (item, parent) => {
                    startFocusFromItem(item, parent?.title)
                      .then(() => addToast(t("dashboard.session.status_focused"), "info"))
                      .catch(() => addToast(t("common.error"), "error"));
                  }
            }
            previewReorder={previewReorder}
            commitReorder={commitReorder}
          />
          <ChecklistInput onCreate={createItem} />
        </ScrollArea>
        <button
          type="button"
          onClick={() => void appModeService.openSecondary("checklist-history")}
          className={compactLinkBtn}
        >
          <HistoryIcon className="h-3.5 w-3.5" />
          {t("app_modes.view_previous_activities")}
        </button>
      </section>
      )}

      {segment === "habits" && (
        <ScrollArea className="min-h-0 flex-1" contentClassName="p-3">
          <HabitCompactList />
        </ScrollArea>
      )}

      {/* Delete confirmation (spec: daily-checklist/confirmed-delete) */}
      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
        <DialogHeader>
          <DialogTitle>{t("checklist.delete_confirm_title")}</DialogTitle>
        </DialogHeader>
        <p className="px-6 pb-2 text-sm text-muted-foreground">
          {t("checklist.delete_confirm_body", { title: deleteTarget?.title ?? "" })}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (deleteTarget) void deleteItem(deleteTarget.id);
              setDeleteTarget(null);
            }}
          >
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

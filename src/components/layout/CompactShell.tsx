import { useRef, useState } from "react";
import {
  History as HistoryIcon,
  Info,
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
import { ChecklistInput } from "@/components/features/checklist/ChecklistInput";
import { ChecklistItemRow } from "@/components/features/checklist/ChecklistItemRow";
import { useChecklist } from "@/hooks/useChecklist";
import { appModeService, overlayService, sessionService } from "@/services/tauri";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import { formatDuration } from "@/utils/formatters";
import { cn } from "@/utils/cn";

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
  const [deleteTarget, setDeleteTarget] = useState<ChecklistItem | null>(null);
  const dragId = useRef<string | null>(null);

  // Same live drag preview as the Checklist page (spec: daily-checklist/drag-reorder).
  const handleDragOver = (overId: string) => {
    const dragging = dragId.current;
    if (!dragging || dragging === overId) return;
    const ids = openView.map((entry) => entry.item.id);
    const fromIndex = ids.indexOf(dragging);
    const toIndex = ids.indexOf(overId);
    if (fromIndex < 0 || toIndex < 0) return;
    ids.splice(toIndex, 0, ids.splice(fromIndex, 1)[0]);
    previewReorder(ids);
  };

  const handleDragEnd = () => {
    if (!dragId.current) return;
    dragId.current = null;
    void commitReorder();
  };

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
        className="relative flex select-none items-center justify-end border-b py-2.5 pr-2"
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
            className={cn(
              "rounded p-1.5 transition-colors hover:bg-accent",
              pinned ? "text-primary" : "text-muted-foreground",
            )}
          >
            {pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void appModeService.openSecondary("about")}
            title={t("nav.about")}
            aria-label={t("nav.about")}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent"
          >
            <Info className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void appModeService.openSecondary("settings")}
            title={t("nav.settings")}
            aria-label={t("nav.settings")}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent"
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
              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* Session block */}
      <section className="border-b p-3">
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
            <div className="grid grid-cols-3 gap-1 text-center text-[11px] text-muted-foreground">
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
            <Button size="sm" className="w-full gap-1.5" onClick={() => void startSession()}>
              <Play className="h-3.5 w-3.5" />
              {t("dashboard.session.start_button")}
            </Button>
          </div>
        )}
        <button
          type="button"
          onClick={() => void appModeService.openSecondary("history")}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <HistoryIcon className="h-3.5 w-3.5" />
          {t("app_modes.view_reports")}
        </button>
      </section>

      {/* Checklist block (full CRUD, compact rows) */}
      <section className="flex min-h-0 flex-1 flex-col p-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("checklist.open_title")}
        </p>
        {/* Scrollbar sits in the section padding; rows keep the block's full width. */}
        <div className="-mr-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-2 [scrollbar-gutter:stable]">
          {openView.length === 0 && (
            <p className="py-3 text-center text-xs text-muted-foreground">
              {t("checklist.empty_open")}
            </p>
          )}
          {openView.map((entry) => (
            <ChecklistItemRow
              key={entry.item.id}
              entry={entry}
              graceMs={graceMs}
              compact
              draggable
              onToggleComplete={(item) => void completeItem(item.id)}
              onUndo={(item) => void uncompleteItem(item.id)}
              onUpdate={(item, patch) => void updateItem(item, patch)}
              onDelete={setDeleteTarget}
              // Hidden while a session runs (spec: daily-checklist/start-from-item).
              onStartFocus={
                activeSession
                  ? undefined
                  : (item) => {
                      startFocusFromItem(item)
                        .then(() => addToast(t("dashboard.session.status_focused"), "info"))
                        .catch(() => addToast(t("common.error"), "error"));
                    }
              }
              onDragStart={(id) => {
                dragId.current = id;
              }}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            />
          ))}
          <ChecklistInput onCreate={createItem} />
        </div>
        <button
          type="button"
          onClick={() => void appModeService.openSecondary("checklist-history")}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <HistoryIcon className="h-3.5 w-3.5" />
          {t("app_modes.view_previous_activities")}
        </button>
      </section>

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

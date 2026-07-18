import { useEffect, useRef, useState } from "react";
import { ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChecklistHistory } from "@/components/features/checklist/ChecklistHistory";
import { ChecklistInput } from "@/components/features/checklist/ChecklistInput";
import { ChecklistItemRow } from "@/components/features/checklist/ChecklistItemRow";
import { useChecklist } from "@/hooks/useChecklist";
import { useSettings } from "@/hooks/useSettings";
import { useChecklistStore } from "@/stores/checklistStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import type { ChecklistItem, ChecklistSortMode } from "@/types";

export function Checklist() {
  const { t } = useTranslation();
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
  const { settings, saveSettings } = useSettings();
  const { addToast } = useUiStore();
  const activeSession = useSessionStore((s) => s.activeSession);
  const setHistoryFilter = useChecklistStore((s) => s.setHistoryFilter);
  const [deleteTarget, setDeleteTarget] = useState<ChecklistItem | null>(null);
  const dragId = useRef<string | null>(null);

  // Last-used sort persists in settings; the date filter always resets to
  // today at store creation (spec: daily-checklist/sort-persistence).
  const persistedSort = settings.checklist.history_sort;
  useEffect(() => {
    setHistoryFilter({ sort: persistedSort });
  }, [persistedSort, setHistoryFilter]);

  // Filter preference, not a real settings edit — no "saved" toast
  // (spec: daily-checklist/sort-persistence).
  const persistSort = (sort: ChecklistSortMode) => {
    saveSettings(
      { ...settings, checklist: { ...settings.checklist, history_sort: sort } },
      { silent: true },
    );
  };

  const handleTagClick = (name: string) => {
    setHistoryFilter({ tags: [name], from: null, to: null });
  };

  const handleStartFocus = async (item: ChecklistItem) => {
    try {
      await startFocusFromItem(item);
      addToast(t("dashboard.session.status_focused"), "info");
    } catch (err) {
      addToast(
        String(err).includes("SessionAlreadyActive")
          ? t("dashboard.session.already_active")
          : t("common.error"),
        "error",
      );
    }
  };

  // Live preview while dragging; the backend write happens once on drop
  // (spec: daily-checklist/drag-reorder).
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

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Open items (spec: daily-checklist/item-carries-over) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4" />
              {t("checklist.open_title")}
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {t("checklist.open_count", {
                  count: openView.filter((entry) => entry.grace === null).length,
                })}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {openView.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("checklist.empty_open")}
              </p>
            )}
            {openView.map((entry) => (
              <ChecklistItemRow
                key={entry.item.id}
                entry={entry}
                graceMs={graceMs}
                draggable
                onToggleComplete={(item) => void completeItem(item.id)}
                onUndo={(item) => void uncompleteItem(item.id)}
                onUpdate={(item, patch) => void updateItem(item, patch)}
                onDelete={setDeleteTarget}
                // Never offer a second session while one runs
                // (spec: daily-checklist/start-from-item).
                onStartFocus={activeSession ? undefined : (item) => void handleStartFocus(item)}
                onTagClick={handleTagClick}
                onDragStart={(id) => {
                  dragId.current = id;
                }}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              />
            ))}
            <ChecklistInput onCreate={createItem} />
          </CardContent>
        </Card>

        {/* History (spec: daily-checklist/history-filtering-and-sorting) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("checklist.history_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChecklistHistory
              onSortPersist={persistSort}
              onRestore={(id) => void uncompleteItem(id)}
            />
          </CardContent>
        </Card>
      </div>

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

import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { SectionCard } from "@/components/ui/section-card";
import { ChecklistHistory } from "@/components/features/checklist/ChecklistHistory";
import { ChecklistGroupToolbar } from "@/components/features/checklist/ChecklistGroupToolbar";
import { ChecklistGroupedList } from "@/components/features/checklist/ChecklistGroupedList";
import { ChecklistInput } from "@/components/features/checklist/ChecklistInput";
import { useChecklist } from "@/hooks/useChecklist";
import { useChecklistView } from "@/hooks/useChecklistView";
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
  const view = useChecklistView();

  const openCount = openView.filter((entry) => entry.grace === null).length;

  const persistedSort = settings.checklist.history_sort;
  useEffect(() => {
    setHistoryFilter({ sort: persistedSort });
  }, [persistedSort, setHistoryFilter]);

  const persistSort = (sort: ChecklistSortMode) => {
    saveSettings(
      { ...settings, checklist: { ...settings.checklist, history_sort: sort } },
      { silent: true },
    );
  };

  const handleTagClick = (name: string) => {
    setHistoryFilter({ tags: [name], from: null, to: null });
  };

  const handleStartFocus = async (item: ChecklistItem, parent?: ChecklistItem) => {
    try {
      await startFocusFromItem(item, parent?.title);
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

  return (
    <PageContainer>
      <PageHeader
        title={t("nav.checklist")}
        description={t("checklist.open_title")}
        actions={
          <span className="text-xs text-muted-foreground">
            {t("checklist.open_count", { count: openCount })}
          </span>
        }
      />

      <SectionCard
        title={t("checklist.open_title")}
        actions={<ListChecks className="h-4 w-4 text-muted-foreground" aria-hidden />}
      >
        <ChecklistGroupToolbar view={view} />
        {openView.length === 0 ? (
          <EmptyState title={t("checklist.empty_open")} className="py-8" />
        ) : (
          <ChecklistGroupedList
            openView={openView}
            groupBy={view.groupBy}
            graceMs={graceMs}
            categoryFilterIds={view.categoryFilterIds}
            createItem={createItem}
            onToggleComplete={(item) => void completeItem(item.id)}
            onUndo={(item) => void uncompleteItem(item.id)}
            onUpdate={(item, patch) => void updateItem(item, patch)}
            onDelete={setDeleteTarget}
            onStartFocus={activeSession ? undefined : handleStartFocus}
            onTagClick={handleTagClick}
            previewReorder={previewReorder}
            commitReorder={commitReorder}
          />
        )}
        <div className="mt-1">
          <ChecklistInput onCreate={createItem} />
        </div>
      </SectionCard>

      <SectionCard title={t("checklist.history_title")}>
        <ChecklistHistory
          onSortPersist={persistSort}
          onRestore={(id) => void uncompleteItem(id)}
        />
      </SectionCard>

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
    </PageContainer>
  );
}

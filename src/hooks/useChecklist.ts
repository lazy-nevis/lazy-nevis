import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { checklistService, sessionService } from "@/services/tauri";
import { useChecklistStore } from "@/stores/checklistStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ChecklistItem, Session } from "@/types";

/** Exit-animation duration; keep in sync with the row's CSS transition. */
export const CHECKLIST_LEAVE_MS = 300;

export interface OpenChecklistEntry {
  item: ChecklistItem;
  /** Non-null while the item sits in the post-completion grace window. */
  grace: { remainingMs: number; leaving: boolean } | null;
}

/**
 * Open-items state shared by every surface that renders the checklist.
 * The grace period is derived from the persisted `completed_at` (DB is the
 * source of truth), so all windows agree — spec: daily-checklist.
 */
export function useChecklist() {
  const { openItems, setOpenItems } = useChecklistStore();
  const graceMs = useSettingsStore((s) => s.settings.checklist.grace_period_ms);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      setOpenItems(await checklistService.listOpen());
    } catch {
      /* backend unavailable — keep current view */
    }
  }, [setOpenItems]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    void refresh();
    listen("checklist:changed", () => void refresh()).then((un) => {
      if (cancelled) un();
      else unlisten = un;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [refresh]);

  // 250 ms sweep only while something is inside a grace window.
  const hasGraceItems = openItems.some((item) => item.completed_at !== null);
  useEffect(() => {
    if (!hasGraceItems) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [hasGraceItems]);

  // Once an item is past grace + exit animation, re-fetch so the backend
  // (whose cutoff is now - grace) drops it from the open list.
  useEffect(() => {
    if (!hasGraceItems) return;
    const fullyExpired = openItems.some(
      (item) =>
        item.completed_at !== null &&
        now >= item.completed_at + graceMs + CHECKLIST_LEAVE_MS + 100,
    );
    if (fullyExpired) void refresh();
  }, [now, hasGraceItems, openItems, graceMs, refresh]);

  const openView: OpenChecklistEntry[] = useMemo(
    () =>
      openItems
        .map((item) => {
          if (item.completed_at === null) return { item, grace: null };
          const remainingMs = item.completed_at + graceMs - now;
          return { item, grace: { remainingMs, leaving: remainingMs <= 0 } };
        })
        // Fully animated-out entries disappear from the render immediately;
        // the refresh above reconciles the store.
        .filter(
          (entry) =>
            entry.grace === null || entry.grace.remainingMs > -CHECKLIST_LEAVE_MS,
        ),
    [openItems, graceMs, now],
  );

  const createItem = useCallback(
    (title: string, tags: string[], dueDate?: number) =>
      checklistService.create(title, tags, dueDate),
    [],
  );

  const updateItem = useCallback(
    (item: ChecklistItem, patch: { title?: string; tags?: string[]; dueDate?: number | null }) =>
      checklistService.update(
        item.id,
        patch.title ?? item.title,
        patch.tags ?? item.tags.map((tag) => tag.name),
        patch.dueDate === undefined ? item.due_date : patch.dueDate,
      ),
    [],
  );

  const completeItem = useCallback((id: string) => checklistService.complete(id), []);
  const uncompleteItem = useCallback((id: string) => checklistService.uncomplete(id), []);
  const deleteItem = useCallback((id: string) => checklistService.delete(id), []);

  /** Local-only reorder used for the live drag preview — no backend call. */
  const previewReorder = useCallback(
    (ids: string[]) => {
      const byId = new Map(useChecklistStore.getState().openItems.map((item) => [item.id, item]));
      const next = ids
        .map((id) => byId.get(id))
        .filter((item): item is ChecklistItem => Boolean(item));
      setOpenItems(next);
    },
    [setOpenItems],
  );

  /** Persists the current store order (called on drop/drag end). */
  const commitReorder = useCallback(async () => {
    const ids = useChecklistStore.getState().openItems.map((item) => item.id);
    await checklistService.reorder(ids);
  }, []);


  /** Spec: daily-checklist/start-from-item. */
  const startFocusFromItem = useCallback(async (item: ChecklistItem): Promise<Session> => {
    const session = await sessionService.start(item.title);
    await checklistService.linkSession(item.id, session.id).catch(() => {});
    useSessionStore.getState().setActiveSession(session);
    useSessionStore.getState().resetCheckpoints();
    return session;
  }, []);

  return {
    openView,
    graceMs,
    refresh,
    createItem,
    updateItem,
    completeItem,
    uncompleteItem,
    deleteItem,
    previewReorder,
    commitReorder,
    startFocusFromItem,
  };
}

import { useCallback, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { checklistService } from "@/services/tauri";
import { useChecklistStore } from "@/stores/checklistStore";
import { TagChip } from "./TagChip";
import type { ChecklistSortMode } from "@/types";
import {
  endOfLocalDay,
  fromDateInputValue,
  shiftDays,
  startOfLocalDay,
  toDateInputValue,
} from "@/utils/dates";
import { formatDate } from "@/utils/formatters";
import { cn } from "@/utils/cn";

const SORT_MODES: { mode: ChecklistSortMode; labelKey: string }[] = [
  { mode: "created", labelKey: "checklist.sort_created" },
  { mode: "due", labelKey: "checklist.sort_due" },
  { mode: "completed", labelKey: "checklist.sort_completed" },
];

interface Props {
  /** Persists the chosen sort into settings (spec: daily-checklist/sort-persistence). */
  onSortPersist: (sort: ChecklistSortMode) => void;
  onRestore: (id: string) => void;
}

export function ChecklistHistory({ onSortPersist, onRestore }: Props) {
  const { t, i18n } = useTranslation();
  const { historyItems, setHistoryItems, allTags, setAllTags, historyFilter, setHistoryFilter } =
    useChecklistStore();

  const load = useCallback(async () => {
    try {
      const [items, tags] = await Promise.all([
        checklistService.listHistory(
          historyFilter.from,
          historyFilter.to,
          historyFilter.sort,
          historyFilter.tags,
        ),
        checklistService.listTags(),
      ]);
      setHistoryItems(items);
      setAllTags(tags);
    } catch {
      /* backend unavailable */
    }
  }, [historyFilter, setHistoryItems, setAllTags]);

  useEffect(() => {
    void load();
  }, [load]);

  // New tags/completions appear in the filters immediately
  // (spec: daily-checklist/history-filtering-and-sorting).
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    listen("checklist:changed", () => void load()).then((un) => {
      if (cancelled) un();
      else unlisten = un;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [load]);

  const stepDays = (delta: number) => {
    const from = historyFilter.from ?? startOfLocalDay(Date.now());
    const to = historyFilter.to ?? endOfLocalDay(Date.now());
    setHistoryFilter({ from: shiftDays(from, delta), to: shiftDays(to, delta) });
  };

  const toggleTag = (name: string) => {
    const active = historyFilter.tags.some((tag) => tag.toLowerCase() === name.toLowerCase());
    setHistoryFilter({
      tags: active
        ? historyFilter.tags.filter((tag) => tag.toLowerCase() !== name.toLowerCase())
        : [...historyFilter.tags, name],
    });
  };

  const chooseSort = (mode: ChecklistSortMode) => {
    setHistoryFilter({ sort: mode });
    onSortPersist(mode);
  };

  return (
    <div>
      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => stepDays(-1)}
          aria-label={t("checklist.prev_day")} title={t("checklist.prev_day")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <input
          type="date"
          value={historyFilter.from !== null ? toDateInputValue(historyFilter.from) : ""}
          onChange={(e) => {
            const parsed = fromDateInputValue(e.target.value);
            setHistoryFilter({ from: parsed !== null ? startOfLocalDay(parsed) : null });
          }}
          aria-label={t("checklist.filter_from")}
          className="h-8 rounded-md border bg-transparent px-2 text-xs"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <input
          type="date"
          value={historyFilter.to !== null ? toDateInputValue(historyFilter.to) : ""}
          onChange={(e) => {
            const parsed = fromDateInputValue(e.target.value);
            setHistoryFilter({ to: parsed !== null ? endOfLocalDay(parsed) : null });
          }}
          aria-label={t("checklist.filter_to")}
          className="h-8 rounded-md border bg-transparent px-2 text-xs"
        />
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => stepDays(1)}
          aria-label={t("checklist.next_day")} title={t("checklist.next_day")}>
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="ml-auto flex gap-1">
          {SORT_MODES.map(({ mode, labelKey }) => (
            <button
              key={mode}
              type="button"
              onClick={() => chooseSort(mode)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                historyFilter.sort === mode
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {allTags.map((tag) => (
            <TagChip
              key={tag.id}
              name={tag.name}
              active={historyFilter.tags.some(
                (selected) => selected.toLowerCase() === tag.name.toLowerCase(),
              )}
              onClick={toggleTag}
            />
          ))}
        </div>
      )}

      {/* Items */}
      {historyItems.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("checklist.empty_history")}
        </p>
      ) : (
        <div className="space-y-1.5">
          {historyItems.map((item) => (
            <div
              key={item.id}
              className="group flex items-center gap-2 rounded-md border bg-card px-3 py-2"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground line-through">{item.title}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  {item.completed_at !== null && (
                    <span>
                      {t("checklist.completed_on", {
                        date: formatDate(item.completed_at, i18n.language),
                      })}
                    </span>
                  )}
                  {item.due_date !== null && (
                    <span className="inline-flex items-center gap-0.5">
                      <Calendar className="h-3 w-3" />
                      {formatDate(item.due_date, i18n.language)}
                    </span>
                  )}
                  {item.tags.map((tag) => (
                    <TagChip key={tag.id} name={tag.name} onClick={toggleTag} />
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRestore(item.id)}
                title={t("checklist.restore")}
                aria-label={t("checklist.restore")}
                className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

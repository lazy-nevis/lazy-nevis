import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { NO_CATEGORY_ID, type ChecklistView } from "@/hooks/useChecklistView";
import type { ChecklistGroupBy } from "@/types";
import { cn } from "@/utils/cn";
import { toneStyle, type Tone } from "@/utils/tones";

const DIMENSIONS: ChecklistGroupBy[] = ["category", "date", "priority"];

/** Group-by selector + category filter chips, shared by the page toolbar and the compact popover. */
export function ChecklistViewControls({ view, className }: { view: ChecklistView; className?: string }) {
  const { t } = useTranslation();
  const { groupBy, categoryFilterIds, categories, setGroupBy, setCategoryFilter } = view;

  const toggleCategory = (id: string) =>
    setCategoryFilter(
      categoryFilterIds.includes(id) ? categoryFilterIds.filter((value) => value !== id) : [...categoryFilterIds, id],
    );

  const chip = (id: string, label: string, tone?: Tone) => (
    <button
      key={id}
      type="button"
      aria-pressed={categoryFilterIds.includes(id)}
      onClick={() => toggleCategory(id)}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-[11px] transition-colors hover:bg-muted/60",
        categoryFilterIds.includes(id) && "border-brand/50 bg-brand/10",
      )}
      style={tone ? toneStyle(tone) : undefined}
    >
      {tone && <span className="tone-dot h-1.5 w-1.5 rounded-full" />}
      {label}
    </button>
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{t("checklist.group_by")}</span>
        <SegmentedControl
          multiple
          aria-label={t("checklist.group_by")}
          value={groupBy}
          onChange={setGroupBy}
          options={DIMENSIONS.map((dim) => ({ value: dim, label: t(`checklist.group_dimension.${dim}`) }))}
        />
      </div>
      {categories.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("checklist.filter_categories")}</span>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => chip(cat.id, cat.name, cat.tone as Tone))}
            {chip(NO_CATEGORY_ID, t("checklist.groups.no_category"))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact/tray: one icon button (next to the settings button) that opens the group/filter popover. */
export function ChecklistViewMenu({ view }: { view: ChecklistView }) {
  const { t } = useTranslation();
  const active = view.groupBy.length + (view.categoryFilterIds.length > 0 ? 1 : 0);
  return (
    <Popover
      align="end"
      ariaLabel={t("checklist.view_options")}
      className="w-72"
      triggerClassName="relative h-6 w-6 justify-center gap-0 rounded border-0 bg-transparent p-0 text-muted-foreground hover:text-foreground"
      trigger={
        <>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {active > 0 && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />}
        </>
      }
    >
      {() => <ChecklistViewControls view={view} />}
    </Popover>
  );
}

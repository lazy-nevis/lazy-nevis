import { useTranslation } from "react-i18next";
import type { ChecklistCategory, ChecklistGroupBy } from "@/types";
import { ChecklistSettingsButton } from "./ChecklistSettingsButton";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/utils/cn";
import { toneStyle, type Tone } from "@/utils/tones";

const DIMENSIONS: ChecklistGroupBy[] = ["category", "date", "priority"];

interface Props {
  groupBy: ChecklistGroupBy[];
  onGroupByChange: (next: ChecklistGroupBy[]) => void;
  categories?: ChecklistCategory[];
  activeCategoryIds: string[];
  onCategoryFilterChange: (ids: string[]) => void;
}

export function ChecklistGroupToolbar({
  groupBy,
  onGroupByChange,
  categories = [],
  activeCategoryIds,
  onCategoryFilterChange,
}: Props) {
  const { t } = useTranslation();

  const toggleCategory = (id: string) => {
    if (activeCategoryIds.includes(id)) {
      onCategoryFilterChange(activeCategoryIds.filter((value) => value !== id));
    } else {
      onCategoryFilterChange([...activeCategoryIds, id]);
    }
  };

  return (
    <div className="mb-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{t("checklist.group_by")}</span>
        <SegmentedControl
          multiple
          aria-label={t("checklist.group_by")}
          value={groupBy}
          onChange={onGroupByChange}
          options={DIMENSIONS.map((dim) => ({
            value: dim,
            label: t(`checklist.group_dimension.${dim}`),
          }))}
        />
        <ChecklistSettingsButton className="ml-auto" />
      </div>
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggleCategory(cat.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-[11px] transition-colors hover:bg-muted/60",
                activeCategoryIds.includes(cat.id) && "border-brand/50 bg-brand/10",
              )}
              style={toneStyle(cat.tone as Tone)}
            >
              <span className="tone-dot h-1.5 w-1.5 rounded-full" />
              {cat.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

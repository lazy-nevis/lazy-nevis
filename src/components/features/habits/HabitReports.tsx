import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "@/components/ui/empty-state";
import { habitService } from "@/services/tauri";
import type { HabitReports } from "@/types";
import { downloadHabitsCsv, downloadJson } from "@/components/features/habits/exportHabits";

type RangeKey = "7" | "30" | "90" | "year";

export function rangeBounds(key: RangeKey, now: number): { from: number; to: number } {
  const to = now;
  if (key === "year") {
    const start = new Date(now);
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    return { from: start.getTime(), to };
  }
  const days = key === "7" ? 7 : key === "30" ? 30 : 90;
  return { from: now - days * 86_400_000, to };
}

export function HabitReportsPanel() {
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });
  const [range, setRange] = useState<RangeKey>("30");
  const [data, setData] = useState<HabitReports | null>(null);

  useEffect(() => {
    const { from, to } = rangeBounds(range, Date.now());
    void habitService.reports(from, to).then(setData).catch(() => setData(null));
  }, [range]);

  const rangeLabel = {
    "7": t("reports_range_7"),
    "30": t("reports_range_30"),
    "90": t("reports_range_90"),
    year: t("reports_range_year"),
  }[range];

  const rangeOptions = (["7", "30", "90", "year"] as RangeKey[]).map((key) => ({
    value: key,
    label:
      key === "7"
        ? t("reports_range_7")
        : key === "30"
          ? t("reports_range_30")
          : key === "90"
            ? t("reports_range_90")
            : t("reports_range_year"),
  }));

  return (
    <div className="space-y-4">
      <SegmentedControl
        aria-label={t("reports_title")}
        value={range}
        onChange={setRange}
        options={rangeOptions}
      />
      <SectionCard title={t("reports_title")} description={rangeLabel}>
        {!data?.rows.length ? (
          <EmptyState title={t("reports_empty")} />
        ) : (
        <div className="space-y-3">
          {data.rows.map((row) => (
            <div key={row.habit_id} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{row.habit_name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {Math.round(row.completion_rate * 100)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted/80">
                <div
                  className="h-full rounded-full bg-brand motion-safe:transition-[width]"
                  style={{ width: `${Math.min(100, row.completion_rate * 100)}%` }}
                />
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void habitService.export().then((payload) =>
                  downloadHabitsCsv(payload, "habits-export.csv"),
                );
              }}
            >
              {t("export_csv")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void habitService.export().then((payload) =>
                  downloadJson("habits-export.json", payload),
                );
              }}
            >
              {t("export_json")}
            </Button>
          </div>
        </div>
        )}
      </SectionCard>
    </div>
  );
}

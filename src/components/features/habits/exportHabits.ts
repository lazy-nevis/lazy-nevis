import type { HabitExport } from "@/types";
import { csvRow } from "@/utils/csv";

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  triggerDownload(filename, blob);
}

export function downloadHabitsCsv(exportData: HabitExport, filename: string) {
  const lines = [
    csvRow([
      "habit_id",
      "habit_name",
      "target_id",
      "metric",
      "unit",
      "value",
      "logged_at",
      "note",
      "source",
    ]),
    ...exportData.logs.map((row) =>
      csvRow([
        row.habit_id,
        row.habit_name,
        row.target_id,
        row.metric,
        row.unit,
        row.value,
        row.logged_at,
        row.note,
        row.source,
      ]),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(filename, blob);
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

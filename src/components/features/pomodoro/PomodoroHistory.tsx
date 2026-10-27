import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { pomodoroService } from "@/services/tauri";
import type { PomodoroRun } from "@/types";

const DAY_MS = 86_400_000;

interface PomodoroHistoryProps {
  onChanged?: () => void;
}

export function PomodoroHistory({ onChanged }: PomodoroHistoryProps) {
  const { t } = useTranslation(undefined, { keyPrefix: "pomodoro" });
  const [runs, setRuns] = useState<PomodoroRun[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<PomodoroRun | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const to = Date.now();
    const from = to - 30 * DAY_MS;
    setRuns(await pomodoroService.listRuns(from, to));
  }, []);

  useEffect(() => {
    void load().then(() => onChanged?.());
  }, [load, onChanged]);

  const exportData = async (format: "json" | "csv") => {
    const to = Date.now();
    const from = to - 30 * DAY_MS;
    const data = await pomodoroService.export(from, to);
    const blob =
      format === "json"
        ? new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
        : new Blob([pomodoroRunsToCsv(data.runs)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pomodoro-${format === "json" ? "export" : "runs"}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await pomodoroService.deleteRun(deleteTarget.id);
      setDeleteTarget(null);
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title={t("history.title")}
      actions={
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void exportData("csv")}>
            {t("history.export_csv")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void exportData("json")}>
            {t("history.export_json")}
          </Button>
        </div>
      }
    >
      {runs.length === 0 ? (
        <EmptyState title={t("history.empty")} />
      ) : (
        <ul className="space-y-2 text-sm">
          {runs.map((run) => (
            <li key={run.id} className="flex items-center justify-between gap-2">
              <span>{run.label ?? t("history.unlabeled")}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {new Date(run.started_at).toLocaleString()}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteTarget(run)}
                >
                  {t("history.delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={deleteTarget != null} onClose={() => setDeleteTarget(null)}>
        <DialogHeader>
          <DialogTitle>{t("history.delete_confirm_title")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("history.delete_confirm_body")}</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
            {t("history.delete_cancel")}
          </Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void confirmDelete()}>
            {t("history.delete_confirm")}
          </Button>
        </DialogFooter>
      </Dialog>
    </SectionCard>
  );
}

function pomodoroRunsToCsv(runs: PomodoroRun[]): string {
  const header = "id,label,started_at,outcome";
  const rows = runs.map((r) =>
    [r.id, csvCell(r.label ?? ""), r.started_at, r.outcome ?? ""].join(","),
  );
  return [header, ...rows].join("\n");
}

function csvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

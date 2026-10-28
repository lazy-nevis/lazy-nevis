import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HabitLogForm } from "@/components/features/habits/HabitLogForm";
import type { Habit, HabitLog, HabitLogInput, HabitLogSource } from "@/types";

export function HabitLogsTable({
  habit,
  logs,
  onUpdate,
  onDelete,
}: {
  habit: Habit;
  logs: HabitLog[];
  onUpdate: (logId: string, input: HabitLogInput) => Promise<void>;
  onDelete: (logId: string) => Promise<void>;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });
  const [editing, setEditing] = useState<HabitLog | null>(null);
  const [deleting, setDeleting] = useState<HabitLog | null>(null);
  const [busy, setBusy] = useState(false);

  const formatValues = (log: HabitLog) =>
    log.values.map((v) => `${v.value}`).join(" · ") || "—";

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">{t("log_when")}</th>
              <th className="px-3 py-2">{t("detail_logs")}</th>
              <th className="px-3 py-2">{t("log_note")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(log.logged_at).toLocaleString()}
                </td>
                <td className="px-3 py-2">{formatValues(log)}</td>
                <td className="px-3 py-2 text-muted-foreground">{log.note ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Button type="button" size="xs" variant="ghost" onClick={() => setEditing(log)}>
                    {t("menu_edit")}
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setDeleting(log)}
                  >
                    {t("log_delete")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={editing != null} onClose={() => setEditing(null)}>
        <DialogHeader>
          <DialogTitle>{t("log_edit_title")}</DialogTitle>
        </DialogHeader>
        {editing && (
          <HabitLogForm
            habit={habit}
            source={editing.source as HabitLogSource}
            triggerEventId={editing.trigger_event_id}
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              setBusy(true);
              try {
                await onUpdate(editing.id, input);
                setEditing(null);
              } finally {
                setBusy(false);
              }
            }}
            initialLoggedAt={editing.logged_at}
            initialNote={editing.note}
            initialValues={editing.values}
          />
        )}
        {busy && <p className="px-4 text-xs text-muted-foreground">{t("save")}…</p>}
      </Dialog>

      <Dialog open={deleting != null} onClose={() => setDeleting(null)}>
        <DialogHeader>
          <DialogTitle>{t("log_delete_confirm_title")}</DialogTitle>
        </DialogHeader>
        <p className="px-4 text-sm text-muted-foreground">{t("log_delete_confirm_body")}</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (!deleting) return;
              void onDelete(deleting.id).then(() => setDeleting(null));
            }}
          >
            {t("log_delete")}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

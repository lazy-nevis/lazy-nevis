import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HabitSkyline } from "@/components/features/habits/HabitSkyline";
import { HabitLogsTable } from "@/components/features/habits/HabitLogsTable";
import { HabitLogDialog } from "@/components/features/habits/HabitLogDialog";
import { downloadHabitsCsv, downloadJson } from "@/components/features/habits/exportHabits";
import { formatProgressLine } from "@/components/features/habits/habitFormat";
import { StatCard } from "@/components/ui/stat-card";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { habitService } from "@/services/tauri";
import type { HabitDetail, HabitLog, HabitLogInput } from "@/types";
import { useSettings } from "@/hooks/useSettings";
import { useUiStore } from "@/stores/uiStore";

export function HabitDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });
  const { settings } = useSettings();
  const addToast = useUiStore((s) => s.addToast);
  const [detail, setDetail] = useState<HabitDetail | null>(null);
  const weekStart = settings.general.week_start ?? 1;
  const [skyline, setSkyline] = useState<{ date: string; value: number }[]>([]);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [focusLog, setFocusLog] = useState<HabitLog | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    const next = await habitService.getDetail(id);
    setDetail(next);
    const to = Date.now();
    const from = to - 365 * 86_400_000;
    const series = await habitService.daySeries(id, from, to);
    setSkyline(series);
  }, [id]);

  useEffect(() => {
    void reload().catch(() => setDetail(null));
  }, [reload]);

  const handleLog = async (input: HabitLogInput) => {
    if (!id) return;
    await habitService.log(id, input);
    addToast(t("logged_toast"));
    await reload();
  };

  const handleUpdateLog = async (logId: string, input: HabitLogInput) => {
    await habitService.updateLog(logId, input);
    addToast(t("logged_toast"));
    await reload();
  };

  const handleDeleteLog = async (logId: string) => {
    await habitService.deleteLog(logId);
    await reload();
  };

  if (!detail) {
    return (
      <PageContainer>
        <p className="text-sm text-muted-foreground">{t("empty_all")}</p>
      </PageContainer>
    );
  }

  const unit = detail.habit.targets[0]?.unit ?? t("units.times");

  return (
    <PageContainer>
      <PageHeader
        title={detail.habit.name}
        description={formatProgressLine(detail.progress.per_target)}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="brand" onClick={() => setLogDialogOpen(true)}>
              {t("log")}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/habits")}>
              {t("cancel")}
            </Button>
          </div>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("detail_stats_streak")} value={String(detail.stats.streak_current)} />
        <StatCard label={t("detail_stats_best")} value={String(detail.stats.streak_best)} />
        <StatCard
          label={t("detail_stats_rate_30")}
          value={`${Math.round(detail.stats.completion_rate_30 * 100)}%`}
        />
      </div>
      <SectionCard title={t("skyline_overview")}>
        <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/30 p-2">
          <HabitSkyline
            tone={detail.habit.tone}
            weekStart={weekStart}
            unit={unit}
            points={skyline}
            habitId={detail.habit.id}
            logs={detail.logs}
            onDayClick={() => undefined}
            onEditLog={(log) => setFocusLog(log)}
          />
        </div>
      </SectionCard>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            void habitService.export(detail.habit.id).then((payload) =>
              downloadHabitsCsv(payload, `${detail.habit.name}-logs.csv`),
            )
          }
        >
          {t("export_csv")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            void habitService.export(detail.habit.id).then((payload) =>
              downloadJson(`${detail.habit.name}.json`, payload),
            )
          }
        >
          {t("export_json")}
        </Button>
      </div>
      <SectionCard title={t("detail_logs")}>
        {detail.logs.length === 0 ? (
          <EmptyState title={t("empty_logs")} />
        ) : (
          <HabitLogsTable
            habit={detail.habit}
            logs={detail.logs}
            onUpdate={handleUpdateLog}
            onDelete={handleDeleteLog}
          />
        )}
      </SectionCard>

      <HabitLogDialog
        open={logDialogOpen || focusLog != null}
        habit={detail.habit}
        progress={detail.progress.per_target}
        onClose={() => {
          setLogDialogOpen(false);
          setFocusLog(null);
        }}
        onSubmit={async (input) => {
          if (focusLog) {
            await handleUpdateLog(focusLog.id, input);
            setFocusLog(null);
          } else {
            await handleLog(input);
            setLogDialogOpen(false);
          }
        }}
        initialLoggedAt={focusLog?.logged_at}
        initialNote={focusLog?.note}
        initialValues={focusLog?.values}
      />
    </PageContainer>
  );
}

import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Check, Clock, TimerReset } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { MarkdownView } from "@/components/features/reminders/MarkdownView";
import { Button } from "@/components/ui/button";
import { GlowCard } from "@/components/ui/glow-card";
import { overlayService } from "@/services/tauri";
import type { OverlayAlertPayload, ReminderOverlay } from "@/types";
import { formatDurationHuman } from "@/utils/formatters";
import { toTone } from "@/utils/tones";

export function Overlay() {
  const { t } = useTranslation();
  const [data, setData] = useState<OverlayAlertPayload | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    document.documentElement.classList.add("overlay-window");
    document.body.classList.add("overlay-window");
    return () => {
      document.documentElement.classList.remove("overlay-window");
      document.body.classList.remove("overlay-window");
    };
  }, []);

  useEffect(() => {
    let unlistenShow: (() => void) | null = null;
    let unlistenHide: (() => void) | null = null;
    let cancelled = false;
    let revision = 0;

    const showPayload = async (payload: OverlayAlertPayload) => {
      const currentRevision = ++revision;
      await i18n.changeLanguage(payload.language);
      if (cancelled || currentRevision !== revision) return;
      setData(payload);
      setNow(Date.now());
    };

    const setup = async () => {
      unlistenShow = await listen<OverlayAlertPayload>("overlay:show", (ev) => {
        void showPayload(ev.payload);
      });
      unlistenHide = await listen("overlay:hide", () => {
        revision += 1;
        setData(null);
      });

      const activePayload = await overlayService.getActive();
      if (activePayload) await showPayload(activePayload);
    };

    setup().catch(() => {
      void overlayService.cancelActive();
    });

    return () => {
      cancelled = true;
      revision += 1;
      unlistenShow?.();
      unlistenHide?.();
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      const reminder = data?.reminder;
      if (data?.kind === "reminder" && reminder) {
        void overlayService
          .resolveAction(reminder.event_id, "dismiss")
          .finally(() => setData(null));
        return;
      }
      void overlayService.dismiss().finally(() => setData(null));
    };

    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [data]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const clock = useMemo(() => {
    return new Intl.DateTimeFormat(data?.language, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: data?.time_format === "12h",
    }).format(new Date(now));
  }, [data?.language, data?.time_format, now]);

  const handleDismiss = async () => {
    try {
      await overlayService.dismiss();
    } finally {
      setData(null);
    }
  };

  if (!data) {
    return <div className="h-screen w-screen bg-transparent" />;
  }

  if (
    (data.kind === "reminder" || data.kind === "pomodoro") &&
    data.reminder
  ) {
    return (
      <ReminderOverlayView
        kind={data.kind}
        reminder={data.reminder}
        clock={clock}
        onResolved={() => setData(null)}
      />
    );
  }

  const activeFor = Math.max(0, now - data.alert_started_at_ms);
  const visibleTitle = data.window_title?.trim();

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent text-white">
      <style>{`
        @keyframes lazy-nevis-alert-red {
          0%, 46%, 100% { opacity: 0.72; transform: scale(1); }
          50%, 62% { opacity: 0.18; transform: scale(1.04); }
        }
        @keyframes lazy-nevis-alert-blue {
          0%, 46%, 100% { opacity: 0.16; transform: scale(1.04); }
          50%, 62% { opacity: 0.68; transform: scale(1); }
        }
      `}</style>

      <div className="absolute inset-0 bg-black/58 backdrop-blur-[2px]" />
      <div
        className="absolute -left-[12vw] top-[-10vh] h-[120vh] w-[58vw] bg-red-600/70 blur-3xl"
        style={{ animation: "lazy-nevis-alert-red 1.1s ease-in-out infinite" }}
      />
      <div
        className="absolute -right-[12vw] top-[-10vh] h-[120vh] w-[58vw] bg-blue-600/70 blur-3xl"
        style={{ animation: "lazy-nevis-alert-blue 1.1s ease-in-out infinite" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.28),rgba(0,0,0,0.62)_62%,rgba(0,0,0,0.78))]" />

      <div className="absolute right-5 top-4 z-10 flex items-center gap-2 text-sm font-semibold text-white/85 drop-shadow">
        <Clock className="h-4 w-4" />
        <span>{clock}</span>
      </div>

      <main className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6 text-center">
        <section className="flex w-full max-w-3xl flex-col items-center">
          <div className="mb-9 flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-2xl">
            <TimerReset className="h-7 w-7 text-orange-200" />
          </div>

          <p className="mb-3 text-xs font-semibold uppercase text-white/62">
            {data.is_test ? t("alerts.fullscreen_test_label") : t("alerts.fullscreen_live_label")}
          </p>

          <h1 className="max-w-full text-balance text-5xl font-semibold leading-tight text-white drop-shadow-2xl md:text-7xl">
            <span className="mr-3 inline-block h-10 w-1 rounded-full bg-sky-400 align-[-0.2em] md:h-14" />
            {t("alerts.fullscreen_message")}
          </h1>

          <p className="mt-5 text-2xl font-medium text-white/92 md:text-3xl">
            {t("alerts.fullscreen_app", {
              app: data.app_name || t("alerts.fullscreen_unknown_app"),
            })}
          </p>

          {visibleTitle && (
            <p className="mt-2 max-w-2xl truncate text-base text-white/62 md:text-lg">
              {visibleTitle}
            </p>
          )}

          <div className="mt-8 grid w-full max-w-2xl grid-cols-2 gap-3 text-left md:grid-cols-4">
            <Metric label={t("alerts.fullscreen_session_time")} value={formatDurationHuman(data.session_elapsed_ms, data.language)} />
            <Metric label={t("alerts.fullscreen_focus_time")} value={formatDurationHuman(data.focus_ms, data.language)} />
            <Metric label={t("alerts.fullscreen_distracted_time")} value={formatDurationHuman(data.distracted_ms, data.language)} />
            <Metric label={t("alerts.fullscreen_active_time")} value={formatDurationHuman(activeFor, data.language)} />
          </div>

          {data.idle_ms > 0 && (
            <p className="mt-4 text-sm text-white/54">
              {t("alerts.fullscreen_idle_time", { time: formatDurationHuman(data.idle_ms, data.language) })}
            </p>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            className="mt-10 inline-flex h-12 min-w-72 items-center justify-center gap-2 rounded-md bg-orange-500 px-8 text-sm font-semibold text-white shadow-2xl shadow-black/35 transition hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:bg-orange-600"
          >
            <Check className="h-4 w-4" />
            {t("alerts.fullscreen_dismiss")}
          </button>
        </section>
      </main>
    </div>
  );
}

function ReminderOverlayView({
  kind,
  reminder,
  clock,
  onResolved,
}: {
  kind: string;
  reminder: ReminderOverlay;
  clock: string;
  onResolved: () => void;
}) {
  const { t } = useTranslation(undefined, {
    keyPrefix: kind === "pomodoro" ? "pomodoro" : "reminders",
  });
  const tone = toTone(reminder.tone);
  const isPomodoro = kind === "pomodoro";

  const resolve = async (action: string, snoozeMinutes?: number) => {
    await overlayService.resolveAction(
      reminder.event_id || null,
      action,
      snoozeMinutes,
    );
    onResolved();
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent text-foreground">
      <div className="absolute inset-0 bg-background/75 backdrop-blur-xl" />
      <div className="absolute right-5 top-4 z-10 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>{clock}</span>
      </div>
      <main className="relative z-10 flex h-full items-center justify-center px-6 py-10">
        <GlowCard
          tone={isPomodoro ? "orange" : tone}
          className="w-full max-w-xl shadow-2xl ring-1 ring-border/60"
        >
          <div className="space-y-4">
            {reminder.late && (
              <span className="inline-flex w-fit rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-warning">
                {t("overlay.late")}
              </span>
            )}
            <h1 className="text-2xl font-semibold leading-tight md:text-3xl">{reminder.title}</h1>
            {reminder.body_md && (
              <MarkdownView
                content={reminder.body_md}
                className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground"
              />
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              {isPomodoro ? (
                <>
                  {reminder.actions.includes("start_next") && (
                    <Button type="button" variant="brand" onClick={() => void resolve("start_next")}>
                      {t("overlay.start_next")}
                    </Button>
                  )}
                  {reminder.actions.includes("skip") && (
                    <Button type="button" variant="secondary" onClick={() => void resolve("skip")}>
                      {t("overlay.skip")}
                    </Button>
                  )}
                  {reminder.actions.includes("dismiss") && (
                    <Button type="button" variant="ghost" onClick={() => void resolve("dismiss")}>
                      {t("overlay.dismiss")}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button type="button" variant="brand" onClick={() => void resolve("done")}>
                    {t("overlay.done")}
                  </Button>
                  <details className="relative">
                    <summary className="cursor-pointer list-none rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
                      {t("overlay.snooze")}
                    </summary>
                    <div className="absolute z-20 mt-1 min-w-40 rounded-lg border border-border bg-popover p-1 shadow-lg">
                      {[
                        { label: t("overlay.snooze_5"), minutes: 5 },
                        { label: t("overlay.snooze_10"), minutes: 10 },
                        { label: t("overlay.snooze_30"), minutes: 30 },
                        { label: t("overlay.snooze_60"), minutes: 60 },
                      ].map((option) => (
                        <button
                          key={option.minutes}
                          type="button"
                          className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => void resolve("snooze", option.minutes)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </details>
                  <Button type="button" variant="ghost" onClick={() => void resolve("dismiss")}>
                    {t("overlay.dismiss")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </GlowCard>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/12 bg-black/18 px-4 py-3 shadow-xl shadow-black/15 backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase text-white/45">{label}</p>
      <p className="mt-1 text-base font-semibold text-white/92">{value}</p>
    </div>
  );
}

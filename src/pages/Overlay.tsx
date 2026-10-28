import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { CSSProperties, ReactNode } from "react";
import { AlarmClock, Bell, Check, Clock, Moon, SkipForward, Target, TimerReset, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { MarkdownView } from "@/components/features/reminders/MarkdownView";
import { overlayService } from "@/services/tauri";
import type { OverlayAlertPayload, ReminderOverlay } from "@/types";
import { formatDurationHuman } from "@/utils/formatters";
import { toneColor, toneStyle, toTone } from "@/utils/tones";

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
      if (data && (data.kind ?? "distraction") !== "distraction" && reminder) {
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

  // Reminders, habits and pomodoro phases share the distraction overlay's frame.
  if ((data.kind ?? "distraction") !== "distraction" && data.reminder) {
    return (
      <ReminderOverlayView
        kind={data.kind ?? "reminder"}
        reminder={data.reminder}
        clock={clock}
        onResolved={() => setData(null)}
      />
    );
  }

  const activeFor = Math.max(0, now - data.alert_started_at_ms);
  const visibleTitle = data.window_title?.trim();

  return (
    <OverlayFrame glow={DISTRACTION_GLOW} clock={clock}>
      <section className="flex w-full max-w-3xl flex-col items-center">
        <OverlayIcon>
          <TimerReset className="h-7 w-7 text-orange-200" />
        </OverlayIcon>

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

        <PrimaryAction onClick={handleDismiss} className="mt-10">
          <Check className="h-4 w-4" />
          {t("alerts.fullscreen_dismiss")}
        </PrimaryAction>
      </section>
    </OverlayFrame>
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
  const { t } = useTranslation();
  const tone = toTone(reminder.tone);
  const isPomodoro = kind === "pomodoro";
  const isHabit = kind === "habit";
  const ns = isPomodoro ? "pomodoro.overlay" : "reminders.overlay";
  const has = (action: string) => reminder.actions.includes(action);

  const resolve = async (action: string, snoozeMinutes?: number) => {
    await overlayService.resolveAction(reminder.event_id || null, action, snoozeMinutes);
    onResolved();
  };

  const glow = isPomodoro
    ? POMODORO_GLOW
    : { primary: toneColor(tone, 0.6), secondary: isHabit ? "rgb(13 148 136 / 0.5)" : "rgb(124 58 237 / 0.5)", speed: "2.8s" };
  const Icon = isPomodoro ? AlarmClock : isHabit ? Target : Bell;
  const primary = isPomodoro
    ? has("start_next") && { action: "start_next", label: t("pomodoro.overlay.start_next") }
    : isHabit
      ? has("log") && { action: "log", label: t("alerts.overlay_log") }
      : { action: "done", label: t("reminders.overlay.done") };
  const snoozeOptions = [5, 10, 30, 60];

  return (
    <OverlayFrame glow={glow} clock={clock}>
      <section className="flex w-full max-w-3xl flex-col items-center">
        <OverlayIcon>
          <Icon className="h-7 w-7 text-white/90" />
        </OverlayIcon>

        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-white/62">
          {t(`alerts.overlay_kind_${isPomodoro ? "pomodoro" : isHabit ? "habit" : "reminder"}`)}
          {reminder.late && (
            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-200">
              {t("reminders.overlay.late")}
            </span>
          )}
        </p>

        <h1 className="max-w-full text-balance text-5xl font-semibold leading-tight text-white drop-shadow-2xl md:text-7xl">
          <span
            className="tone-dot mr-3 inline-block h-10 w-1 rounded-full align-[-0.2em] md:h-14"
            style={isPomodoro ? { backgroundColor: "rgb(251 146 60)" } : toneStyle(tone)}
          />
          {reminder.title}
        </h1>

        {reminder.body_md && (
          <div className="mt-8 max-h-[32vh] w-full max-w-2xl overflow-y-auto rounded-md border border-white/12 bg-black/18 px-5 py-4 text-left shadow-xl shadow-black/15 backdrop-blur-sm">
            <MarkdownView
              content={reminder.body_md}
              className="prose prose-sm prose-invert max-w-none text-white/85"
            />
          </div>
        )}

        {primary && (
          <PrimaryAction onClick={() => void resolve(primary.action)} className="mt-10">
            <Check className="h-4 w-4" />
            {primary.label}
          </PrimaryAction>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {has("snooze") && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-md border border-white/12 bg-black/18 p-1 backdrop-blur-sm">
              <span className="flex items-center gap-1.5 px-2 text-xs font-semibold uppercase text-white/50">
                <Moon className="h-3.5 w-3.5" />
                {t("reminders.overlay.snooze")}
              </span>
              {snoozeOptions.map((minutes) => (
                <SecondaryAction key={minutes} onClick={() => void resolve("snooze", minutes)}>
                  {t(`reminders.overlay.snooze_${minutes}`)}
                </SecondaryAction>
              ))}
            </div>
          )}
          {has("skip") && (
            <SecondaryAction onClick={() => void resolve("skip")}>
              <SkipForward className="h-3.5 w-3.5" />
              {t("pomodoro.overlay.skip")}
            </SecondaryAction>
          )}
          <SecondaryAction onClick={() => void resolve("dismiss")}>
            <X className="h-3.5 w-3.5" />
            {t(`${ns}.dismiss`)}
          </SecondaryAction>
        </div>
        <p className="mt-6 text-xs text-white/40">{t("alerts.overlay_escape_hint")}</p>
      </section>
    </OverlayFrame>
  );
}

interface Glow {
  primary: string;
  secondary: string;
  speed: string;
}

const DISTRACTION_GLOW: Glow = {
  primary: "rgb(220 38 38 / 0.7)",
  secondary: "rgb(37 99 235 / 0.7)",
  speed: "1.1s",
};

const POMODORO_GLOW: Glow = {
  primary: "rgb(249 115 22 / 0.65)",
  secondary: "rgb(225 29 72 / 0.5)",
  speed: "2.8s",
};

/** Shared fullscreen frame: dimmed backdrop, two alternating glows, vignette and clock. */
function OverlayFrame({ glow, clock, children }: { glow: Glow; clock: string; children: ReactNode }) {
  const glowStyle = (color: string, name: string): CSSProperties => ({
    backgroundColor: color,
    animation: `${name} ${glow.speed} ease-in-out infinite`,
  });
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
        className="absolute -left-[12vw] top-[-10vh] h-[120vh] w-[58vw] blur-3xl"
        style={glowStyle(glow.primary, "lazy-nevis-alert-red")}
      />
      <div
        className="absolute -right-[12vw] top-[-10vh] h-[120vh] w-[58vw] blur-3xl"
        style={glowStyle(glow.secondary, "lazy-nevis-alert-blue")}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.28),rgba(0,0,0,0.62)_62%,rgba(0,0,0,0.78))]" />

      <div className="absolute right-5 top-4 z-10 flex items-center gap-2 text-sm font-semibold text-white/85 drop-shadow">
        <Clock className="h-4 w-4" />
        <span>{clock}</span>
      </div>

      <main className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6 text-center">
        {children}
      </main>
    </div>
  );
}

function OverlayIcon({ children }: { children: ReactNode }) {
  return (
    <div className="mb-9 flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-2xl">
      {children}
    </div>
  );
}

function PrimaryAction({
  onClick,
  className,
  children,
}: {
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-12 min-w-72 items-center justify-center gap-2 rounded-md bg-orange-500 px-8 text-sm font-semibold text-white shadow-2xl shadow-black/35 transition hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:bg-orange-600 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

function SecondaryAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/15 bg-white/8 px-3.5 text-sm font-medium text-white/85 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    >
      {children}
    </button>
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

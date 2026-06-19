import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/stores/uiStore";
import { audioService, sessionService } from "@/services/tauri";
import { formatDurationHuman } from "@/utils/formatters";
import { Button } from "@/components/ui/button";

export function FullscreenAlert() {
  const { t } = useTranslation();
  const { isFullscreenAlert, fullscreenAlertApp, fullscreenAlertMs, hideFullscreenAlert } =
    useUiStore();

  const frameRef = useRef<number>(0);
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isFullscreenAlert) return;

    let frame = 0;
    const animate = () => {
      frame++;
      if (bgRef.current) {
        const isRed = Math.floor(frame / 30) % 2 === 0;
        bgRef.current.style.backgroundColor = isRed ? "#D63031" : "#0984E3";
      }
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [isFullscreenAlert]);

  const handleDismiss = () => {
    audioService.stop().catch(() => {});
    sessionService.recordAlertDismissed("fullscreen").catch(() => {});
    hideFullscreenAlert();
  };

  if (!isFullscreenAlert) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none">
      <div
        ref={bgRef}
        className="absolute inset-0"
        style={{ backgroundColor: "#D63031" }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 text-white text-center px-8">
        <div className="text-6xl font-black tracking-widest uppercase drop-shadow-lg">
          {t("alerts.fullscreen_message")}
        </div>

        <div className="text-2xl font-semibold opacity-90">
          {t("alerts.fullscreen_app", { app: fullscreenAlertApp })}
        </div>

        <div className="text-xl opacity-80">
          {t("alerts.fullscreen_time", { time: formatDurationHuman(fullscreenAlertMs) })}
        </div>

        <Button
          onClick={handleDismiss}
          size="lg"
          className="mt-4 bg-white text-gray-900 hover:bg-gray-100 font-bold text-lg px-8 py-3 h-auto shadow-xl"
        >
          {t("alerts.fullscreen_dismiss")}
        </Button>
      </div>
    </div>
  );
}

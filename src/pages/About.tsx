import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, Heart } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { checkForUpdate, type ReleaseInfo } from "@/services/updates";
import logoDark from "@/assets/brand/logo-dark.png";
import logoLight from "@/assets/brand/logo-light.png";

export function About() {
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.settings.general.theme);
  const [version, setVersion] = useState("...");
  const [checking, setChecking] = useState(false);
  const [update, setUpdate] = useState<ReleaseInfo | null>(null);
  const [updateResult, setUpdateResult] = useState<
    { kind: "available" | "current" | "error"; message: string } | null
  >(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setUpdateAvailable = useUiStore((state) => state.setUpdateAvailable);

  useEffect(() => () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  }, []);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion(t("common.unavailable")));
  }, [t]);

  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) ||
    document.documentElement.classList.contains("dark");

  // logo-dark (dark artwork) → visible on light backgrounds
  // logo-light (light artwork) → visible on dark backgrounds
  const logoSrc = isDark ? logoLight : logoDark;

  const openLink = (url: string) => {
    openUrl(url).catch(() => undefined);
  };
  // The result appears as a colored alert that auto-dismisses after 5 s; the
  // "open release" button stays until the next check.
  const showResult = (kind: "available" | "current" | "error", message: string) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setUpdateResult({ kind, message });
    dismissTimerRef.current = setTimeout(() => setUpdateResult(null), 5_000);
  };

  const handleUpdateCheck = async () => {
    setChecking(true);
    setUpdateResult(null);
    try {
      const available = await checkForUpdate(version);
      setUpdate(available);
      setUpdateAvailable(available?.version ?? null);
      showResult(
        available ? "available" : "current",
        t(available ? "about.update_available" : "about.up_to_date", {
          version: available?.version,
        }),
      );
    } catch {
      showResult("error", t("about.update_failed"));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Centered but full-width content: header, side-by-side info cards, and a
          horizontal action row keep the page short enough to avoid scrolling. */}
      <div className="mx-auto w-full max-w-3xl px-8 pt-8 pb-8 space-y-6">

        {/* Header: logo, tagline, description */}
        <div className="flex flex-col items-center gap-3 text-center">
          <img
            src={logoSrc}
            alt="LazyNevis"
            className="h-20 w-auto object-contain"
            draggable={false}
          />
          <p className="text-muted-foreground italic text-sm">
            {t("common.tagline")}
          </p>
          <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
            {t("about.description")}
          </p>
        </div>

        {/* Name origin + author, side by side */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
            <p className="text-sm font-semibold">{t("about.tagline_title")}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("about.tagline_body")}
            </p>
            <p className="text-xs text-muted-foreground/60 italic">
              {t("common.tagline_note")}
            </p>
          </div>

          <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {t("about.created_by")}
            </p>
            <p className="text-sm font-semibold">
              {t("about.author_name")}
            </p>
            <div className="flex gap-4 flex-wrap mt-1">
              <button
                onClick={() => openLink("https://github.com/simstm")}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                {t("about.author_github")}
              </button>
              <button
                onClick={() => openLink("https://sims.dev.br")}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                {t("about.author_site")}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{t("about.open_source")}</p>
          </div>
        </div>

        {/* Actions as a single row */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            variant="outline"
            onClick={() => openLink("https://github.com/lazy-nevis/lazy-nevis")}
            className="gap-2 w-full"
          >
            <ExternalLink className="h-4 w-4" />
            {t("about.github")}
          </Button>

          <Button variant="outline" onClick={handleUpdateCheck} disabled={checking || version === "..."} className="w-full">
            {checking ? t("about.checking_update") : t("about.check_update")}
          </Button>

          <Button
            variant="outline"
            onClick={() => openLink("https://www.buymeacoffee.com/simstm")}
            className="gap-2 w-full"
          >
            <Heart className="h-4 w-4" aria-hidden="true" />
            {t("about.donate")}
          </Button>
        </div>

        {updateResult && (
          <div
            role="status"
            className={cn(
              "fade-slide-in flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm",
              updateResult.kind === "available" && "border-primary/40 bg-primary/10",
              updateResult.kind === "current" && "border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400",
              updateResult.kind === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
            )}
          >
            {updateResult.kind === "available" && <Download className="h-4 w-4 shrink-0" aria-hidden="true" />}
            {updateResult.kind === "current" && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
            {updateResult.kind === "error" && <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />}
            {updateResult.message}
          </div>
        )}
        {update && (
          <Button onClick={() => openLink(update.url)} className="w-full gap-2">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {t("about.open_release")}
          </Button>
        )}

        {/* Footer line */}
        <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-xs text-muted-foreground border-t pt-4">
          <span>{t("about.version")} {version}</span>
          <span>·</span>
          <button
            onClick={() => openLink("https://github.com/lazy-nevis/lazy-nevis/blob/main/LICENSE")}
            className="hover:underline"
          >
            {t("about.license")}
          </button>
          <span>·</span>
          <span>{t("about.built_with")}</span>
        </div>

      </div>
    </div>
  );
}

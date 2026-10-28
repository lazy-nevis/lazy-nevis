import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, Heart } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { SectionCard } from "@/components/ui/section-card";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUpdateStore } from "@/stores/updateStore";
import { checkForUpdate } from "@/services/updates";
import logoDark from "@/assets/brand/logo-dark.png";
import logoLight from "@/assets/brand/logo-light.png";

export function About() {
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.settings.general.theme);
  const [version, setVersion] = useState("...");
  const [checking, setChecking] = useState(false);
  const update = useUpdateStore((s) => s.release);
  const setRelease = useUpdateStore((s) => s.setRelease);
  const markSeen = useUpdateStore((s) => s.markSeen);
  const [updateResult, setUpdateResult] = useState<
    { kind: "available" | "current" | "error"; message: string } | null
  >(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  }, []);

  // Opening the details settles the sidebar badge, tray dot and dashboard alert.
  const pendingVersion = update?.version;
  useEffect(() => {
    if (pendingVersion) markSeen();
  }, [pendingVersion, markSeen]);

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
      setRelease(available);
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
    <PageContainer>
      <PageHeader title={t("about.title")} description={t("about.description")} />

      <div className="flex flex-col items-center gap-3 text-center">
        <img
          src={logoSrc}
          alt="LazyNevis"
          className="h-20 w-auto object-contain"
          draggable={false}
        />
        <p className="text-sm italic text-muted-foreground">{t("common.tagline")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title={t("about.tagline_title")}>
          <p className="text-xs leading-relaxed text-muted-foreground">{t("about.tagline_body")}</p>
          <p className="mt-2 text-xs italic text-muted-foreground/70">{t("common.tagline_note")}</p>
        </SectionCard>

        <SectionCard title={t("about.created_by")}>
          <p className="text-sm font-semibold">{t("about.author_name")}</p>
          <div className="mt-2 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => openLink("https://github.com/simstm")}
              className="flex items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              <ExternalLink className="h-3 w-3" />
              {t("about.author_github")}
            </button>
            <button
              type="button"
              onClick={() => openLink("https://sims.dev.br")}
              className="flex items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              <ExternalLink className="h-3 w-3" />
              {t("about.author_site")}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("about.open_source")}</p>
        </SectionCard>
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
              updateResult.kind === "current" && "border-success/40 bg-success/10 text-success",
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
          <section
            aria-label={t("update.card_title")}
            className="fade-slide-in rounded-xl border border-notice/50 bg-notice/10 p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Download className="h-4 w-4 text-notice" aria-hidden="true" />
                {t("update.card_title")}
              </h2>
              <span className="rounded-full bg-notice px-2 py-0.5 text-xs font-medium text-notice-foreground">
                {t("update.card_version", { version: update.version })}
              </span>
            </div>
            {update.notes && (
              <div className="mt-3">
                <h3 className="text-xs font-medium text-muted-foreground">{t("update.notes_title")}</h3>
                <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed">
                  {update.notes}
                </p>
              </div>
            )}
            <Button onClick={() => openLink(update.url)} className="mt-3 w-full gap-2">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {t("about.open_release")}
            </Button>
          </section>
        )}

        {/* Footer line */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border/60 pt-4 text-xs text-muted-foreground">
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

    </PageContainer>
  );
}

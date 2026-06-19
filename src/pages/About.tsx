import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { ExternalLink, Heart } from "lucide-react";
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
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const setUpdateAvailable = useUiStore((state) => state.setUpdateAvailable);

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
  const handleUpdateCheck = async () => {
    setChecking(true);
    setUpdateMessage(null);
    try {
      const available = await checkForUpdate(version);
      setUpdate(available);
      setUpdateAvailable(available?.version ?? null);
      setUpdateMessage(t(available ? "about.update_available" : "about.up_to_date", {
        version: available?.version,
      }));
    } catch {
      setUpdateMessage(t("about.update_failed"));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-sm mx-auto px-6 pt-8 pb-10 space-y-6">

        {/* Logo — bigger and at the top */}
        <div className="flex justify-center">
          <img
            src={logoSrc}
            alt="LazyNevis"
            className="h-20 w-auto object-contain"
            draggable={false}
          />
        </div>

        {/* Tagline */}
        <p className="text-center text-muted-foreground italic text-sm">
          {t("common.tagline")}
        </p>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("about.description")}
        </p>

        {/* Name origin */}
        <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
          <p className="text-sm font-semibold">{t("about.tagline_title")}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("about.tagline_body")}
          </p>
          <p className="text-xs text-muted-foreground/60 italic">
            {t("common.tagline_note")}
          </p>
        </div>

        {/* Author */}
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

        {/* Links */}
        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={() => openLink("https://github.com/simstm/lazy-nevis")}
            className="gap-2 w-full"
          >
            <ExternalLink className="h-4 w-4" />
            {t("about.github")}
          </Button>

          <Button variant="outline" onClick={handleUpdateCheck} disabled={checking || version === "..."} className="w-full">
            {checking ? t("about.checking_update") : t("about.check_update")}
          </Button>
          {updateMessage && <p className="text-center text-xs text-muted-foreground" role="status">{updateMessage}</p>}
          {update && (
            <Button onClick={() => openLink(update.url)} className="w-full gap-2">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {t("about.open_release")}
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => openLink("https://www.buymeacoffee.com/simstm")}
            className="gap-2 w-full"
          >
            <Heart className="h-4 w-4" aria-hidden="true" />
            {t("about.donate")}
          </Button>

          <div className="flex justify-center items-center gap-3 text-xs text-muted-foreground">
            <span>{t("about.version")} {version}</span>
            <span>·</span>
            <button
              onClick={() => openLink("https://github.com/simstm/lazy-nevis/blob/main/LICENSE")}
              className="hover:underline"
            >
              {t("about.license")}
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {t("about.built_with")}
          </p>
        </div>

      </div>
    </div>
  );
}

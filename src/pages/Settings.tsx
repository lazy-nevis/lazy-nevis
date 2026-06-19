import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Plus, X, Volume2, Play, Square, FolderOpen, RefreshCw,
  Globe, Target, Bell, Music, Coffee, Keyboard, Database, Info, Cpu, Check, Clock,
  Shield, CheckCircle, AlertTriangle, XCircle, ExternalLink, LogIn,
} from "lucide-react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { HotkeyInput } from "@/components/ui/HotkeyInput";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { useSettings } from "@/hooks/useSettings";
import { monitorService, audioService, overlayService, permissionsService, type RunningApp } from "@/services/tauri";
import { useUiStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogHeader, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/utils/cn";
import type { AppSettings, PermissionState, PermissionsStatus } from "@/types";

type Tab = "general" | "focus_rules" | "alerts" | "audio" | "breaks" | "shortcuts" | "permissions" | "data";

const TAB_META: Record<Tab, { icon: React.ReactNode; labelKey: string }> = {
  general:     { icon: <Globe className="h-4 w-4" />,    labelKey: "settings.tabs.general" },
  focus_rules: { icon: <Target className="h-4 w-4" />,   labelKey: "settings.tabs.focus_rules" },
  alerts:      { icon: <Bell className="h-4 w-4" />,     labelKey: "settings.tabs.alerts" },
  audio:       { icon: <Music className="h-4 w-4" />,    labelKey: "settings.tabs.audio" },
  breaks:      { icon: <Coffee className="h-4 w-4" />,   labelKey: "settings.tabs.breaks" },
  shortcuts:   { icon: <Keyboard className="h-4 w-4" />, labelKey: "settings.tabs.shortcuts" },
  permissions: { icon: <Shield className="h-4 w-4" />,   labelKey: "settings.tabs.permissions" },
  data:        { icon: <Database className="h-4 w-4" />, labelKey: "settings.tabs.data" },
};

export function Settings() {
  const { t } = useTranslation();
  const { settings, saveSettings, resetSettings } = useSettings();
  const { addToast } = useUiStore();
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [clearConfirm, setClearConfirm] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const update = (patch: Partial<AppSettings>) => {
    saveSettings({ ...settings, ...patch });
  };

  return (
    <div className="flex h-full">
      {/* Tab sidebar */}
      <nav className="w-40 shrink-0 border-r py-4 flex flex-col gap-0.5 px-2">
        {(Object.entries(TAB_META) as [Tab, typeof TAB_META[Tab]][]).map(([tab, meta]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex items-center gap-2.5 text-left text-sm px-3 py-2 rounded-md transition-colors",
              activeTab === tab
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            {meta.icon}
            {t(meta.labelKey)}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "general" && <GeneralTab settings={settings} update={update} t={t} />}
        {activeTab === "focus_rules" && <FocusRulesTab settings={settings} update={update} t={t} addToast={addToast} />}
        {activeTab === "alerts" && <AlertsTab settings={settings} update={update} t={t} />}
        {activeTab === "audio" && <AudioTab settings={settings} update={update} t={t} addToast={addToast} />}
        {activeTab === "breaks" && <BreaksTab settings={settings} update={update} t={t} />}
        {activeTab === "shortcuts" && <ShortcutsTab settings={settings} update={update} t={t} />}
        {activeTab === "permissions" && <PermissionsTab t={t} />}
        {activeTab === "data" && (
          <DataTab t={t} onClearHistory={() => setClearConfirm(true)} onResetSettings={() => setResetConfirm(true)} />
        )}
      </div>

      <Dialog open={clearConfirm} onClose={() => setClearConfirm(false)}>
        <DialogHeader>
          <DialogTitle>{t("settings.data.clear_history_confirm")}</DialogTitle>
          <DialogClose onClose={() => setClearConfirm(false)} />
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setClearConfirm(false)}>{t("common.cancel")}</Button>
          <Button variant="destructive" onClick={async () => {
            const { sessionService } = await import("@/services/tauri");
            await sessionService.clearAll();
            addToast(t("history.session_deleted"));
            setClearConfirm(false);
          }}>{t("common.confirm")}</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={resetConfirm} onClose={() => setResetConfirm(false)}>
        <DialogHeader>
          <DialogTitle>{t("settings.data.reset_settings")}</DialogTitle>
          <DialogClose onClose={() => setResetConfirm(false)} />
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setResetConfirm(false)}>{t("common.cancel")}</Button>
          <Button variant="destructive" onClick={async () => { await resetSettings(); setResetConfirm(false); }}>
            {t("common.confirm")}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

// ─── Shared components ─────────────────────────────────────────────────────────

function SettingRow({ icon, label, hint, children }: {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border/50 last:border-0">
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        {icon && <span className="mt-0.5 text-muted-foreground shrink-0">{icon}</span>}
        <div>
          <p className="text-sm font-medium">{label}</p>
          {hint && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{hint}</p>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionTitle({ icon, titleKey, descKey, t }: {
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
  t: (k: string) => string;
}) {
  return (
    <div className="flex items-start gap-3 mb-5 pb-4 border-b">
      <div className="rounded-lg bg-primary/10 p-2 text-primary mt-0.5">{icon}</div>
      <div>
        <h2 className="font-semibold text-base">{t(titleKey)}</h2>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t(descKey)}</p>
      </div>
    </div>
  );
}

// ─── General ──────────────────────────────────────────────────────────────────

function GeneralTab({ settings, update, t }: TabProps) {
  return (
    <div>
      <SectionTitle icon={<Globe className="h-4 w-4" />} titleKey="settings.tabs.general" descKey="settings.section_desc.general" t={t} />

      <SettingRow icon={<Globe className="h-4 w-4" />} label={t("settings.general.language")}>
        <Select value={settings.general.language}
          onChange={(e) => update({ general: { ...settings.general, language: e.target.value } })}
          className="w-36">
          <option value="en-US">{t("settings.general.language_en")}</option>
          <option value="pt-BR">{t("settings.general.language_pt")}</option>
        </Select>
      </SettingRow>

      <SettingRow icon={<Info className="h-4 w-4" />} label={t("settings.general.theme")}>
        <Select value={settings.general.theme}
          onChange={(e) => update({ general: { ...settings.general, theme: e.target.value as "light" | "dark" | "system" } })}
          className="w-36">
          <option value="system">{t("settings.general.theme_system")}</option>
          <option value="light">{t("settings.general.theme_light")}</option>
          <option value="dark">{t("settings.general.theme_dark")}</option>
        </Select>
      </SettingRow>

      <SettingRow icon={<Clock className="h-4 w-4" />} label={t("settings.general.time_format")}>
        <Select value={settings.general.time_format}
          onChange={(e) => update({ general: { ...settings.general, time_format: e.target.value as "12h" | "24h" } })}
          className="w-36">
          <option value="24h">{t("settings.general.time_format_24h")}</option>
          <option value="12h">{t("settings.general.time_format_12h")}</option>
        </Select>
      </SettingRow>

      <SettingRow icon={<Cpu className="h-4 w-4" />} label={t("settings.general.polling_interval")} hint={t("settings.general.polling_interval_hint")}>
        <div className="flex items-center gap-2">
          <Input type="number" min={500} max={5000} step={100}
            value={settings.general.polling_interval_ms}
            onChange={(e) => update({ general: { ...settings.general, polling_interval_ms: Math.max(500, Number(e.target.value)) } })}
            className="w-24" />
          <span className="text-xs text-muted-foreground">{t("common.units.ms")}</span>
        </div>
      </SettingRow>

      <SettingRow icon={<Info className="h-4 w-4" />} label={t("settings.general.micro_threshold")} hint={t("settings.general.micro_threshold_hint")}>
        <div className="flex items-center gap-2">
          <Input type="number" min={0} max={10000} step={500}
            value={settings.general.micro_event_threshold_ms}
            onChange={(e) => update({ general: { ...settings.general, micro_event_threshold_ms: Number(e.target.value) } })}
            className="w-24" />
          <span className="text-xs text-muted-foreground">{t("common.units.ms")}</span>
        </div>
      </SettingRow>

      <SettingRow icon={<Info className="h-4 w-4" />} label={t("settings.general.start_minimized")} hint={t("settings.general.start_minimized_hint")}>
        <Switch checked={settings.general.start_minimized}
          onCheckedChange={(v) => update({ general: { ...settings.general, start_minimized: v } })} />
      </SettingRow>

      <SettingRow icon={<LogIn className="h-4 w-4" />} label={t("settings.general.launch_at_login")} hint={t("settings.general.launch_at_login_hint")}>
        <Switch checked={settings.general.launch_at_login}
          onCheckedChange={(v) => update({ general: { ...settings.general, launch_at_login: v } })} />
      </SettingRow>
    </div>
  );
}

// ─── Focus Rules ──────────────────────────────────────────────────────────────

function FocusRulesTab({ settings, update, t, addToast }: TabProps & { addToast: (m: string, t?: "success" | "error" | "info") => void }) {
  const [newApp, setNewApp] = useState("");
  const [newTerm, setNewTerm] = useState("");
  const [runningApps, setRunningApps] = useState<RunningApp[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadRunningApps = useCallback(async () => {
    setLoadingApps(true);
    try {
      const apps = await monitorService.listRunningApps();
      setRunningApps(apps);
    } catch {
      addToast(t("common.error"), "error");
    } finally {
      setLoadingApps(false);
    }
  }, [addToast, t]);

  useEffect(() => { loadRunningApps(); }, [loadRunningApps]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredApps = runningApps.filter((app) => {
    const q = newApp.toLowerCase();
    return !q || app.exe.toLowerCase().includes(q) || app.name.toLowerCase().includes(q);
  });

  const addApp = (exeName?: string) => {
    const app = (exeName ?? newApp).trim();
    if (!app || settings.focus_rules.apps.includes(app)) return;
    update({ focus_rules: { ...settings.focus_rules, apps: [...settings.focus_rules.apps, app] } });
    setNewApp("");
    setShowDropdown(false);
  };

  const removeApp = (app: string) =>
    update({ focus_rules: { ...settings.focus_rules, apps: settings.focus_rules.apps.filter((a) => a !== app) } });

  const addTerm = () => {
    const term = newTerm.trim();
    if (!term || settings.focus_rules.browser_tab_terms.includes(term)) return;
    update({ focus_rules: { ...settings.focus_rules, browser_tab_terms: [...settings.focus_rules.browser_tab_terms, term] } });
    setNewTerm("");
  };

  const removeTerm = (term: string) =>
    update({ focus_rules: { ...settings.focus_rules, browser_tab_terms: settings.focus_rules.browser_tab_terms.filter((t) => t !== term) } });

  return (
    <div>
      <SectionTitle icon={<Target className="h-4 w-4" />} titleKey="settings.tabs.focus_rules" descKey="settings.section_desc.focus_rules" t={t} />

      {/* Mode */}
      <div className="mb-5">
        <p className="text-sm font-medium mb-1">{t("settings.focus_rules.mode_label")}</p>
        <div className="space-y-2">
          {(["allowlist", "blocklist"] as const).map((mode) => (
            <label key={mode} className="flex items-start gap-3 text-sm cursor-pointer p-2 rounded-lg hover:bg-accent/50 transition-colors">
              <input type="radio" name="mode" value={mode}
                checked={settings.focus_rules.mode === mode}
                onChange={() => update({ focus_rules: { ...settings.focus_rules, mode } })}
                className="accent-primary mt-0.5 shrink-0"
              />
              <div>
                <span className="font-medium capitalize">{mode}</span>
                <p className="text-xs text-muted-foreground">{t(`settings.focus_rules.mode_${mode}_desc`)}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* App autocomplete */}
      <div className="mb-5">
        <p className="text-sm font-medium mb-1">{t("settings.focus_rules.apps_label")}</p>
        <p className="text-xs text-muted-foreground mb-2">{t("settings.focus_rules.apps_hint")}</p>

        <div className="relative">
          <div className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                placeholder={t("settings.focus_rules.apps_placeholder")}
                value={newApp}
                onChange={(e) => { setNewApp(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onKeyDown={(e) => { if (e.key === "Enter") addApp(); if (e.key === "Escape") setShowDropdown(false); }}
                className="text-sm"
              />

              {/* Dropdown — inside the relative wrapper so it aligns to the input */}
              {showDropdown && filteredApps.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute top-full left-0 right-0 z-50 mt-1 max-h-52 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
                >
                  {filteredApps.slice(0, 40).map((app) => {
                    const alreadyAdded = settings.focus_rules.apps.includes(app.exe);
                    return (
                      <button
                        key={`${app.exe}-${app.pid}`}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors",
                          alreadyAdded && "opacity-50 pointer-events-none"
                        )}
                        onClick={() => { if (!alreadyAdded) addApp(app.exe); }}
                        type="button"
                      >
                        <Cpu className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate min-w-0 flex-1">{app.exe}</span>
                        <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{app.name}</span>
                        <span className="text-xs text-muted-foreground/50 shrink-0">PID {app.pid}</span>
                        {alreadyAdded && <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <Button variant="outline" size="sm" onClick={() => addApp()} disabled={!newApp.trim()}>
              <Plus className="h-4 w-4 mr-1" /> {t("settings.focus_rules.add_app")}
            </Button>
            <Button variant="outline" size="icon" onClick={loadRunningApps} disabled={loadingApps} title={t("common.refresh")} aria-label={t("common.refresh")}>
              <RefreshCw className={cn("h-4 w-4", loadingApps && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Added apps chips */}
        {settings.focus_rules.apps.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {settings.focus_rules.apps.map((app) => (
              <span key={app} className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                {app}
                <button onClick={() => removeApp(app)} className="ml-1 opacity-60 hover:opacity-100">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Browser tab rules */}
      <div className="pt-4 border-t">
        <p className="text-sm font-semibold mb-1">{t("settings.focus_rules.browser_rules_title")}</p>
        <p className="text-xs text-muted-foreground mb-3">{t("settings.focus_rules.browser_rules_hint")}</p>

        <div className="mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{t("settings.focus_rules.tab_mode")}</p>
          <Select value={settings.focus_rules.browser_tab_mode}
            onChange={(e) => update({ focus_rules: { ...settings.focus_rules, browser_tab_mode: e.target.value as "allowlist" | "blocklist" } })}
            className="w-full max-w-xs">
            <option value="blocklist">{t("settings.focus_rules.tab_mode_blocklist_desc")}</option>
            <option value="allowlist">{t("settings.focus_rules.tab_mode_allowlist_desc")}</option>
          </Select>
        </div>

        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{t("settings.focus_rules.browser_tab_terms")}</p>
        <div className="flex gap-2 mb-2">
          <Input placeholder={t("settings.focus_rules.browser_tab_placeholder")}
            value={newTerm} onChange={(e) => setNewTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTerm()} className="text-sm" />
          <Button variant="outline" size="sm" onClick={addTerm}><Plus className="h-4 w-4" /></Button>
        </div>
        {settings.focus_rules.browser_tab_terms.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {settings.focus_rules.browser_tab_terms.map((term) => (
              <span key={term} className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs">
                {term}
                <button onClick={() => removeTerm(term)} aria-label={t("common.remove", { item: term })} className="ml-1 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

function AlertsTab({ settings, update, t }: TabProps) {
  const msToSec = (ms: number) => Math.round(ms / 1000);
  const secToMs = (s: number) => s * 1000;

  return (
    <div>
      <SectionTitle icon={<Bell className="h-4 w-4" />} titleKey="settings.tabs.alerts" descKey="settings.section_desc.alerts" t={t} />

      <div className="rounded-lg border p-4 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 pr-4">
            <p className="text-sm font-semibold">{t("settings.alerts.notification_enabled")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("settings.alerts.notification_desc")}</p>
          </div>
          <Switch checked={settings.alerts.notification_enabled}
            onCheckedChange={(v) => update({ alerts: { ...settings.alerts, notification_enabled: v } })} />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground w-24 shrink-0">{t("settings.alerts.notification_threshold")}</label>
          <Input type="number" min={5} max={300}
            value={msToSec(settings.alerts.notification_threshold_ms)}
            onChange={(e) => update({ alerts: { ...settings.alerts, notification_threshold_ms: secToMs(Number(e.target.value)) } })}
            disabled={!settings.alerts.notification_enabled} className="w-20" />
          <span className="text-xs text-muted-foreground">{t("settings.alerts.seconds_suffix")}</span>
        </div>
      </div>

      <div className="rounded-lg border p-4 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 pr-4">
            <p className="text-sm font-semibold">{t("settings.alerts.fullscreen_enabled")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("settings.alerts.fullscreen_desc")}</p>
          </div>
          <Switch checked={settings.alerts.fullscreen_enabled}
            onCheckedChange={(v) => update({ alerts: { ...settings.alerts, fullscreen_enabled: v } })} />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground w-24 shrink-0">{t("settings.alerts.fullscreen_threshold")}</label>
          <Input type="number" min={10} max={600}
            value={msToSec(settings.alerts.fullscreen_threshold_ms)}
            onChange={(e) => update({ alerts: { ...settings.alerts, fullscreen_threshold_ms: secToMs(Number(e.target.value)) } })}
            disabled={!settings.alerts.fullscreen_enabled} className="w-20" />
          <span className="text-xs text-muted-foreground">{t("settings.alerts.seconds_suffix")}</span>
        </div>
      </div>

      <SettingRow icon={<Bell className="h-4 w-4" />} label={t("settings.alerts.cooldown")} hint={t("settings.alerts.cooldown_hint")}>
        <div className="flex items-center gap-2">
          <Input type="number" min={0} max={300}
            value={msToSec(settings.alerts.cooldown_ms)}
            onChange={(e) => update({ alerts: { ...settings.alerts, cooldown_ms: secToMs(Number(e.target.value)) } })}
            className="w-20" />
          <span className="text-xs text-muted-foreground">{t("common.units.seconds")}</span>
        </div>
      </SettingRow>

      {/* Test buttons */}
      <div className="mt-6 pt-4 border-t">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          {t("settings.audio.test_section")}
        </p>
        <div className="flex gap-3 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              import("@tauri-apps/api/event").then(({ emit }) =>
                emit("alert:show", {
                  session_id: "test",
                  app_name: "YouTube",
                  distracted_ms: 35_000,
                  alert_type: "notification",
                })
              );
            }}
          >
            <Bell className="h-4 w-4" />
            {t("settings.audio.test_notification")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              overlayService.show("Instagram", 65_000, true).catch(() => {});
              import("@tauri-apps/api/event").then(({ emit }) =>
                emit("alert:fullscreen", {
                  session_id: "test",
                  app_name: "Instagram",
                  distracted_ms: 65_000,
                  alert_type: "fullscreen",
                })
              );
            }}
          >
            <Bell className="h-4 w-4" />
            {t("settings.audio.test_fullscreen")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {t("settings.audio.test_hint")}
        </p>
      </div>
    </div>
  );
}

// ─── Audio ────────────────────────────────────────────────────────────────────

// Labels resolved via t() inside the component since we need the translator
const BUILTIN_SOUND_KEYS = [
  { value: "builtin:alert1.wav", labelKey: "settings.audio.builtin_alert1" },
  { value: "builtin:alarm.wav",  labelKey: "settings.audio.builtin_alarm" },
  { value: "builtin:chime.wav",  labelKey: "settings.audio.builtin_chime" },
];

function AudioTab({ settings, update, t, addToast }: TabProps & { addToast: (m: string, t?: "success" | "error" | "info") => void }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<import("@/services/tauri").RecentAudioFile[]>([]);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load recent files on mount
  useEffect(() => {
    audioService.getRecentFiles().then(setRecentFiles).catch(() => {});
  }, []);

  // Listen for audio:finished to reset the play button automatically
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("audio:finished", () => {
        setPlaying(null);
      }).then((fn) => { unlisten = fn; });
    });
    return () => { unlisten?.(); };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const togglePlay = async (source: string) => {
    if (playing === source) {
      await audioService.stop().catch(() => {});
      setPlaying(null);
      return;
    }
    try {
      if (playing) await audioService.stop();
      await audioService.play(source, settings.audio.volume, false);
      setPlaying(source);
      // No auto-stop — user clicks Stop
    } catch (err) {
      addToast(t("common.error") + " — " + String(err), "error");
      setPlaying(null);
    }
  };

  const pickFile = async (field: "notification_sound" | "fullscreen_sound") => {
    try {
      const selected = await openFileDialog({
        multiple: false,
        filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg"] }],
      });
      if (typeof selected === "string") {
        const fileName = selected.split(/[/\\]/).pop() ?? selected;
        update({ audio: { ...settings.audio, [field]: selected } });
        // Save to recent files
        await audioService.addRecentFile(selected, fileName);
        const updated = await audioService.getRecentFiles();
        setRecentFiles(updated);
        setShowDropdown(null);
      }
    } catch { addToast(t("common.error"), "error"); }
  };

  const selectSound = async (
    value: string,
    label: string,
    field: "notification_sound" | "fullscreen_sound",
    isCustom: boolean,
  ) => {
    update({ audio: { ...settings.audio, [field]: value } });
    if (isCustom) {
      await audioService.addRecentFile(value, label).catch(() => {});
      const updated = await audioService.getRecentFiles().catch(() => recentFiles);
      setRecentFiles(updated);
    }
    setShowDropdown(null);
  };

  function SoundPicker({ label, hint, field, enabled, enabledField }: {
    label: string;
    hint: string;
    field: "notification_sound" | "fullscreen_sound";
    enabled: boolean;
    enabledField: "notification_sound_enabled" | "fullscreen_sound_enabled";
  }) {
    const value = settings.audio[field];
    const isPlaying = playing === value;
    const isOpen = showDropdown === field;

    const builtinEntry = BUILTIN_SOUND_KEYS.find((s) => s.value === value);
    const displayLabel =
      (builtinEntry ? t(builtinEntry.labelKey) : null)
      ?? recentFiles.find((r) => r.path === value)?.label
      ?? value.split(/[/\\]/).pop()
      ?? value;

    return (
      <div className={cn("rounded-lg border p-4 mb-4", !enabled && "opacity-60")}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 pr-4">
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
          </div>
          <Switch checked={enabled}
            onCheckedChange={(v) => update({ audio: { ...settings.audio, [enabledField]: v } })} />
        </div>

        <div className="flex gap-2 items-center">
          {/* Custom dropdown */}
          <div className="relative flex-1 min-w-0" ref={isOpen ? dropdownRef : undefined}>
            <button
              type="button"
              disabled={!enabled}
              onClick={() => setShowDropdown(isOpen ? null : field)}
              className={cn(
                "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm text-left",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              <span className="truncate">{displayLabel}</span>
              <span className="ml-2 text-muted-foreground">▾</span>
            </button>

            {isOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-52 overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-lg">
                {/* Built-in section */}
                <div className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wide border-b">
                  {t("settings.audio.builtin_section")}
                </div>
                {BUILTIN_SOUND_KEYS.map((s) => {
                  const label = t(s.labelKey);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between",
                        value === s.value && "bg-accent/60 font-medium"
                      )}
                      onClick={() => selectSound(s.value, label, field, false)}
                    >
                      {label}
                      {value === s.value && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  );
                })}

                {/* Recent files section */}
                {recentFiles.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wide border-t border-b">
                      {t("settings.audio.recent_section")}
                    </div>
                    {recentFiles.map((r) => (
                      <button
                        key={r.path}
                        type="button"
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2",
                          value === r.path && "bg-accent/60 font-medium"
                        )}
                        onClick={() => selectSound(r.path, r.label, field, false)}
                      >
                        <span className="truncate text-xs">📁 {r.label}</span>
                        {value === r.path && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </button>
                    ))}
                  </>
                )}

                {/* Browse for file */}
                <div className="border-t">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 text-muted-foreground"
                    onClick={() => pickFile(field)}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    {t("settings.audio.custom_file")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Play/Stop button */}
          <Button
            variant={isPlaying ? "destructive" : "outline"}
            size="icon"
            onClick={() => togglePlay(value)}
            disabled={!enabled}
            title={isPlaying ? t("settings.audio.stop") : t("settings.audio.preview")}
          >
            {isPlaying ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle icon={<Music className="h-4 w-4" />} titleKey="settings.tabs.audio" descKey="settings.section_desc.audio" t={t} />

      <SettingRow icon={<Volume2 className="h-4 w-4" />} label={t("settings.audio.volume")}>
        <div className="flex items-center gap-3 w-44">
          <Slider value={Math.round(settings.audio.volume * 100)} min={0} max={100}
            onChange={(v) => update({ audio: { ...settings.audio, volume: v / 100 } })} />
          <span className="text-xs w-8 text-right tabular-nums">{Math.round(settings.audio.volume * 100)}%</span>
        </div>
      </SettingRow>

      <div className="mt-4">
        <SoundPicker
          label={t("settings.audio.notification_sound")} hint={t("settings.audio.notification_sound_desc")}
          field="notification_sound" enabled={settings.audio.notification_sound_enabled}
          enabledField="notification_sound_enabled"
        />
        <SoundPicker
          label={t("settings.audio.fullscreen_sound")} hint={t("settings.audio.fullscreen_sound_desc")}
          field="fullscreen_sound" enabled={settings.audio.fullscreen_sound_enabled}
          enabledField="fullscreen_sound_enabled"
        />
      </div>
    </div>
  );
}

// ─── Breaks ───────────────────────────────────────────────────────────────────

function BreaksTab({ settings, update, t }: TabProps) {
  const msToMin = (ms: number) => Math.round(ms / 60_000);
  const minToMs = (m: number) => m * 60_000;

  return (
    <div>
      <SectionTitle icon={<Coffee className="h-4 w-4" />} titleKey="settings.tabs.breaks" descKey="settings.section_desc.breaks" t={t} />

      <SettingRow icon={<Coffee className="h-4 w-4" />} label={t("settings.breaks.enabled")}>
        <Switch checked={settings.breaks.enabled}
          onCheckedChange={(v) => update({ breaks: { ...settings.breaks, enabled: v } })} />
      </SettingRow>

      <SettingRow icon={<Info className="h-4 w-4" />} label={t("settings.breaks.focus_interval")} hint={t("settings.breaks.focus_interval_hint")}>
        <div className="flex items-center gap-2">
          <Input type="number" min={5} max={120}
            value={msToMin(settings.breaks.focus_interval_ms)}
            onChange={(e) => update({ breaks: { ...settings.breaks, focus_interval_ms: minToMs(Number(e.target.value)) } })}
            disabled={!settings.breaks.enabled} className="w-20" />
          <span className="text-xs text-muted-foreground">{t("common.units.minutes")}</span>
        </div>
      </SettingRow>

      <SettingRow icon={<Info className="h-4 w-4" />} label={t("settings.breaks.break_duration")} hint={t("settings.breaks.break_duration_hint")}>
        <div className="flex items-center gap-2">
          <Input type="number" min={1} max={60}
            value={msToMin(settings.breaks.break_duration_ms)}
            onChange={(e) => update({ breaks: { ...settings.breaks, break_duration_ms: minToMs(Number(e.target.value)) } })}
            disabled={!settings.breaks.enabled} className="w-20" />
          <span className="text-xs text-muted-foreground">{t("common.units.minutes")}</span>
        </div>
      </SettingRow>

      <SettingRow icon={<Bell className="h-4 w-4" />} label={t("settings.breaks.alert_type")}>
        <Select value={settings.breaks.alert_type}
          onChange={(e) => update({ breaks: { ...settings.breaks, alert_type: e.target.value as "notification" | "fullscreen" } })}
          disabled={!settings.breaks.enabled} className="w-44">
          <option value="notification">{t("settings.breaks.type_notification")}</option>
          <option value="fullscreen">{t("settings.breaks.type_fullscreen")}</option>
        </Select>
      </SettingRow>
    </div>
  );
}

// ─── Shortcuts ────────────────────────────────────────────────────────────────

type ShortcutKey = "toggle_focus" | "stop_session" | "open_home" | "add_checkpoint";

const SHORTCUT_META: { key: ShortcutKey; labelI18n: string; hintI18n: string }[] = [
  { key: "toggle_focus", labelI18n: "settings.shortcuts.toggle_focus", hintI18n: "settings.shortcuts.toggle_focus_hint" },
  { key: "stop_session", labelI18n: "settings.shortcuts.stop_session", hintI18n: "settings.shortcuts.stop_session_hint" },
  { key: "open_home", labelI18n: "settings.shortcuts.open_home", hintI18n: "settings.shortcuts.open_home_hint" },
  { key: "add_checkpoint", labelI18n: "settings.shortcuts.add_checkpoint", hintI18n: "settings.shortcuts.add_checkpoint_hint" },
];

function ShortcutsTab({ settings, update, t }: TabProps) {
  return (
    <div>
      <SectionTitle
        icon={<Keyboard className="h-4 w-4" />}
        titleKey="settings.tabs.shortcuts"
        descKey="settings.section_desc.shortcuts"
        t={t}
      />

      <p className="text-xs text-muted-foreground mb-4">
        {t("settings.shortcuts.instructions_before")} {" "}
        <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px]">Esc</kbd>{" "}
        {t("settings.shortcuts.instructions_after")}
      </p>

      {SHORTCUT_META.map(({ key, labelI18n, hintI18n }) => (
        <SettingRow
          key={key}
          icon={<Keyboard className="h-4 w-4" />}
          label={t(labelI18n)}
          hint={t(hintI18n)}
        >
          <HotkeyInput
            value={settings.shortcuts[key] ?? ""}
            onChange={(v) =>
              update({ shortcuts: { ...settings.shortcuts, [key]: v } })
            }
          />
        </SettingRow>
      ))}
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

function DataTab({ t, onClearHistory, onResetSettings }: { t: TFunction; onClearHistory: () => void; onResetSettings: () => void }) {
  return (
    <div>
      <SectionTitle icon={<Database className="h-4 w-4" />} titleKey="settings.tabs.data" descKey="settings.section_desc.data" t={t} />
      <Card>
        <CardContent className="py-4 space-y-3">
          <p className="text-xs text-muted-foreground">{t("settings.data.destructive_warning")}</p>
          <Button variant="destructive" onClick={onClearHistory} className="w-full justify-start gap-2">
            {t("settings.data.clear_history")}
          </Button>
          <Button variant="outline" onClick={onResetSettings} className="w-full justify-start gap-2">
            {t("settings.data.reset_settings")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Permissions ──────────────────────────────────────────────────────────────

function PermissionsTab({ t }: { t: TFunction }) {
  const [status, setStatus] = useState<PermissionsStatus | null>(null);
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, notif] = await Promise.all([
        permissionsService.check(),
        isPermissionGranted(),
      ]);
      setStatus(s);
      setNotifGranted(notif);
    } catch (e) {
      console.error("Permission check failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const requestNotif = async () => {
    const r = await requestPermission();
    setNotifGranted(r === "granted");
    refresh();
  };

  const isMac = status?.platform === "macos";
  const allOk = notifGranted &&
    (status?.accessibility === "granted" || status?.accessibility === "notrequired");

  function PermRow({ label, desc, stateVal, children }: {
    label: string; desc: string;
    stateVal: PermissionState; children?: React.ReactNode;
  }) {
    const stateLabel = {
      granted: t("permissions.status.granted"),
      denied: t("permissions.status.denied"),
      notrequired: t("permissions.status.not_required"),
      notdetermined: t("permissions.status.not_determined"),
    }[stateVal];

    return (
      <div className={cn("rounded-lg border p-4",
        stateVal === "granted" ? "border-green-200 dark:border-green-800"
        : stateVal === "denied" ? "border-red-200 dark:border-red-800"
        : "border-border"
      )}>
        <div className="flex items-start gap-3">
          {stateVal === "granted"
            ? <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            : stateVal === "denied"
            ? <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            : stateVal === "notrequired"
            ? <CheckCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            : <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="text-sm font-semibold">{label}</p>
              <span className={cn("text-xs px-1.5 py-0.5 rounded-full",
                stateVal === "granted" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : stateVal === "denied" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
              )}>{stateLabel}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
          </div>
          {children && <div className="shrink-0 ml-2 flex gap-2">{children}</div>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle
        icon={<Shield className="h-4 w-4" />}
        titleKey="permissions.title"
        descKey="permissions.section_desc"
        t={t}
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <div className="space-y-3">
          <PermRow
            label={t("permissions.notifications.label")}
            desc={t("permissions.notifications.desc")}
            stateVal={notifGranted ? "granted" : "notdetermined"}
          >
            {!notifGranted && (
              <Button size="sm" onClick={requestNotif}>{t("permissions.request")}</Button>
            )}
          </PermRow>

          {isMac && (
            <PermRow
              label={t("permissions.accessibility.label")}
              desc={t("permissions.accessibility.desc")}
              stateVal={status?.accessibility ?? "notdetermined"}
            >
              {status?.accessibility !== "granted" && (
                <Button size="sm" variant="outline" className="gap-1.5"
                  onClick={async () => {
                    await permissionsService.openAccessibilitySettings();
                    setTimeout(refresh, 3000);
                  }}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("permissions.open_settings")}
                </Button>
              )}
            </PermRow>
          )}
        </div>
      )}

      {allOk && (
        <div className="mt-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-3 py-2.5 flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {t("permissions.all_ok")}
        </div>
      )}

      <div className="mt-4">
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {t("permissions.recheck")}
        </Button>
      </div>
    </div>
  );
}

// ─── Shared types ─────────────────────────────────────────────────────────────

interface TabProps {
  settings: AppSettings;
  update: (p: Partial<AppSettings>) => void;
  t: TFunction;
}

import { Suspense, lazy, useEffect, useState } from "react";
import { HashRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { isPermissionGranted } from "@tauri-apps/plugin-notification";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { CompactShell } from "@/components/layout/CompactShell";
import { Sidebar } from "@/components/layout/Sidebar";
import { TitleBar } from "@/components/layout/TitleBar";
import { ToastContainer } from "@/components/layout/ToastContainer";
import { PermissionsModal } from "@/components/features/PermissionsModal";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useAppStatus } from "@/hooks/useAppStatus";
import { useSettings } from "@/hooks/useSettings";
import { useFocusSession } from "@/hooks/useFocusSession";
import { useThemeSync } from "@/hooks/useThemeSync";
import { useWindowTitle } from "@/hooks/useWindowTitle";
import { overlayService, permissionsService, sessionService } from "@/services/tauri";
import { useUiStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { AppSettings } from "@/types";
import i18n from "@/i18n";

const Dashboard  = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const History    = lazy(() => import("@/pages/History").then((m) => ({ default: m.History })));
const ChecklistPage = lazy(() => import("@/pages/Checklist").then((m) => ({ default: m.Checklist })));
const SettingsPage = lazy(() => import("@/pages/Settings").then((m) => ({ default: m.Settings })));
const About      = lazy(() => import("@/pages/About").then((m) => ({ default: m.About })));
const OverlayPage = lazy(() => import("@/pages/Overlay").then((m) => ({ default: m.Overlay })));
const TrayPopoverPage = lazy(() => import("@/pages/TrayPopover").then((m) => ({ default: m.TrayPopover })));
const SecondaryShellPage = lazy(() => import("@/pages/SecondaryShell").then((m) => ({ default: m.SecondaryShell })));
const LinkedItemPrompt = lazy(() =>
  import("@/components/features/checklist/LinkedItemPrompt").then((m) => ({
    default: m.LinkedItemPrompt,
  })),
);

// NOTE: Does NOT call useFocusSession to avoid duplicate listener registration.
// Uses sessionService and store directly instead.
function CloseWarningDialog() {
  const { t } = useTranslation();
  const { isCloseWarningOpen, setCloseWarningOpen } = useUiStore();
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const resetCheckpoints = useSessionStore((s) => s.resetCheckpoints);

  const handleConfirm = async () => {
    setCloseWarningOpen(false);
    try {
      await sessionService.stop(t("app.close_note"));
      await overlayService.cancelActive().catch(() => {});
      setActiveSession(null);
      resetCheckpoints();
    } catch { /* already stopped */ }
    // Hide window to tray after ending session
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = await getCurrentWindow();
      await win.hide();
    } catch { /* window already hidden */ }
  };

  return (
    <Dialog open={isCloseWarningOpen} onClose={() => setCloseWarningOpen(false)}>
      <DialogHeader>
        <DialogTitle>{t("app.close_warning_title")}</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        {t("app.close_warning_body")}
      </p>
      <DialogFooter>
        <Button variant="outline" onClick={() => setCloseWarningOpen(false)}>
          {t("app.close_keep")}
        </Button>
        <Button variant="destructive" onClick={handleConfirm}>
          {t("app.close_confirm")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

const ROUTE_TITLE_KEYS: Record<string, string> = {
  "/": "nav.dashboard",
  "/history": "nav.history",
  "/checklist": "nav.checklist",
  "/settings": "nav.settings",
  "/about": "nav.about",
};

function AppShell() {
  const { t } = useTranslation();
  useSettings();
  const { mode, pinned, isFullscreen } = useAppStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPermissions, setShowPermissions] = useState(false);

  // Single call to useFocusSession — sets up all Tauri event listeners
  useFocusSession();

  useThemeSync();

  // "LazyNevis — <screen>" follows the active route (or Compact Mode)
  // (spec: app-modes/window-titles).
  const screenTitle = t(
    mode === "compact"
      ? "app_modes.compact_title"
      : ROUTE_TITLE_KEYS[location.pathname] ?? "nav.dashboard",
  );
  useWindowTitle(screenTitle);

  // Settings edited in the secondary window propagate back here
  // (spec: app-modes/settings-propagate).
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<AppSettings>("settings:changed", (ev) => {
      useSettingsStore.getState().setSettings(ev.payload);
      void i18n.changeLanguage(ev.payload.general.language);
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  // Navigate to home when shortcut fires
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen("shortcut:open_home", () => navigate("/")).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [navigate]);

  // Screenshot demo: Rust poses navigate the HashRouter without WebDriver.
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<{ path: string }>("demo:navigate", (ev) => {
      if (typeof ev.payload?.path === "string") {
        navigate(ev.payload.path);
      }
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [navigate]);

  // Screenshot demo: re-hydrate session store after synthetic poses.
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen("demo:refresh-session", () => {
      void sessionService.getRuntime().then((runtime) => {
        useSessionStore.getState().hydrateRuntime(runtime);
      }).catch(() => {
        useSessionStore.getState().hydrateRuntime(null);
      });
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  // Permission check on startup (skipped in screenshot demo mode)
  useEffect(() => {
    const check = async () => {
      try {
        const demoActive = await invoke<boolean>("demo_is_active").catch(() => false);
        if (demoActive) return;
        const [notifOk, status] = await Promise.all([
          isPermissionGranted(),
          permissionsService.check(),
        ]);
        const accessOk = status.accessibility === "granted" || status.accessibility === "notrequired";
        if (!notifOk || !accessOk) {
          setTimeout(() => setShowPermissions(true), 1200);
        }
      } catch { /* non-fatal */ }
    };
    check();
  }, []);

  // Compact Mode swaps the whole layout; shared dialogs/toasts render in both
  // (spec: app-modes/switch-to-compact).
  if (mode === "compact") {
    return (
      <>
        <CompactShell pinned={pinned} isFullscreen={isFullscreen} />
        <ToastContainer />
        <CloseWarningDialog />
        <Suspense fallback={null}>
          <LinkedItemPrompt />
        </Suspense>
        <PermissionsModal open={showPermissions} onClose={() => setShowPermissions(false)} />
      </>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Custom macOS title bar (spec: app-modes/custom-title-bar) */}
      <TitleBar title={screenTitle} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <Suspense fallback={
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              {t("common.loading")}
            </div>
          }>
            <Routes>
              <Route path="/"          element={<Dashboard />} />
              <Route path="/history"   element={<History />} />
              <Route path="/checklist" element={<ChecklistPage />} />
              <Route path="/settings"  element={<SettingsPage />} />
              <Route path="/about"     element={<About />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <ToastContainer />
      <CloseWarningDialog />
      <Suspense fallback={null}>
        <LinkedItemPrompt />
      </Suspense>
      <PermissionsModal open={showPermissions} onClose={() => setShowPermissions(false)} />
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <RootRoutes />
    </HashRouter>
  );
}

function RootRoutes() {
  const location = useLocation();

  if (location.pathname === "/overlay") {
    return (
      <Suspense fallback={<div className="h-screen w-screen bg-transparent" />}>
        <Routes>
          <Route path="/overlay" element={<OverlayPage />} />
        </Routes>
      </Suspense>
    );
  }

  // Tray quick panel — bare root, no AppShell/useFocusSession (spec: tray-quick-panel).
  if (location.pathname === "/tray") {
    return (
      <Suspense fallback={<div className="h-screen w-screen bg-background" />}>
        <Routes>
          <Route path="/tray" element={<TrayPopoverPage />} />
        </Routes>
      </Suspense>
    );
  }

  // Reusable secondary window for Compact Mode (spec: app-modes).
  if (location.pathname === "/secondary") {
    return (
      <Suspense fallback={<div className="h-screen w-screen bg-background" />}>
        <Routes>
          <Route path="/secondary" element={<SecondaryShellPage />} />
        </Routes>
      </Suspense>
    );
  }

  return <AppShell />;
}

export default App;

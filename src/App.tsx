import { Suspense, lazy, useEffect, useState } from "react";
import { HashRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { isPermissionGranted } from "@tauri-apps/plugin-notification";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "@/components/layout/Sidebar";
import { ToastContainer } from "@/components/layout/ToastContainer";
import { PermissionsModal } from "@/components/features/PermissionsModal";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/hooks/useSettings";
import { useFocusSession } from "@/hooks/useFocusSession";
import { overlayService, permissionsService, sessionService } from "@/services/tauri";
import { useUiStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";

const Dashboard  = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const History    = lazy(() => import("@/pages/History").then((m) => ({ default: m.History })));
const SettingsPage = lazy(() => import("@/pages/Settings").then((m) => ({ default: m.Settings })));
const About      = lazy(() => import("@/pages/About").then((m) => ({ default: m.About })));
const OverlayPage = lazy(() => import("@/pages/Overlay").then((m) => ({ default: m.Overlay })));

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

function AppShell() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [showPermissions, setShowPermissions] = useState(false);

  // Single call to useFocusSession — sets up all Tauri event listeners
  useFocusSession();

  // Theme sync
  useEffect(() => {
    const root = document.documentElement;
    const theme = settings.general.theme;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      root.classList.toggle("dark", mq.matches);
      const handler = (e: MediaQueryListEvent) => root.classList.toggle("dark", e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [settings.general.theme]);

  // Navigate to home when shortcut fires
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen("shortcut:open_home", () => navigate("/")).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [navigate]);

  // Permission check on startup
  useEffect(() => {
    const check = async () => {
      try {
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

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            {t("common.loading")}
          </div>
        }>
          <Routes>
            <Route path="/"         element={<Dashboard />} />
            <Route path="/history"  element={<History />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/about"    element={<About />} />
          </Routes>
        </Suspense>
      </main>
      <ToastContainer />
      <CloseWarningDialog />
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

  return <AppShell />;
}

export default App;

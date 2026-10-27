import React from "react";
import ReactDOM from "react-dom/client";
import i18n from "@/i18n";
import "./index.css";
import App from "./App";

// The Vite dev server is reachable from a normal browser tab, where every Tauri
// command fails. Render a notice instead of the app so nothing tries to hydrate or
// persist settings without the backend.
const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function BrowserNotice() {
  return (
    <main className="flex h-screen items-center justify-center bg-background p-6 text-center text-foreground">
      <div className="max-w-sm space-y-2">
        <h1 className="text-lg font-semibold">{i18n.t("runtime.browser_title")}</h1>
        <p className="text-sm text-muted-foreground">{i18n.t("runtime.browser_body")}</p>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{inTauri ? <App /> : <BrowserNotice />}</React.StrictMode>,
);

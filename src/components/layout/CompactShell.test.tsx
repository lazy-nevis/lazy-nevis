import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/i18n";
import { appModeService, checklistService, sessionService, settingsService } from "@/services/tauri";
import { useChecklistStore } from "@/stores/checklistStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { CompactShell } from "./CompactShell";

beforeEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage("en-US");
  useSessionStore.setState({ activeSession: null, liveStats: null, checkpoints: [], hydrationStatus: "ready" });
  useChecklistStore.setState({ openItems: [] });
  vi.spyOn(settingsService, "get").mockResolvedValue(useSettingsStore.getState().settings);
  vi.spyOn(checklistService, "listOpen").mockImplementation(async () =>
    useChecklistStore.getState().openItems,
  );
});

describe("CompactShell", () => {
  // Spec scenario: app-modes/switch-to-compact
  it("renders session and checklist blocks with top-bar controls", async () => {
    render(<CompactShell pinned={false} />);

    expect(await screen.findByRole("button", { name: "Switch to Full Mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pin on top" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View reports" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View previous activities" })).toBeInTheDocument();
  });

  it("mode toggle and pin invoke the app-mode commands", async () => {
    const setMode = vi.spyOn(appModeService, "setMode").mockResolvedValue();
    const setPin = vi.spyOn(appModeService, "setPin").mockResolvedValue();
    render(<CompactShell pinned={false} />);

    fireEvent.click(await screen.findByRole("button", { name: "Switch to Full Mode" }));
    await waitFor(() => expect(setMode).toHaveBeenCalledWith("full"));

    fireEvent.click(screen.getByRole("button", { name: "Pin on top" }));
    await waitFor(() => expect(setPin).toHaveBeenCalledWith(true));
  });

  // Spec scenario: app-modes/open-settings-without-disturbing-the-dock
  it("secondary screens open through open_secondary_window", async () => {
    const openSecondary = vi.spyOn(appModeService, "openSecondary").mockResolvedValue();
    render(<CompactShell pinned={false} />);

    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await waitFor(() => expect(openSecondary).toHaveBeenCalledWith("settings"));

    fireEvent.click(screen.getByRole("button", { name: "View reports" }));
    await waitFor(() => expect(openSecondary).toHaveBeenCalledWith("history"));

    fireEvent.click(screen.getByRole("button", { name: "View previous activities" }));
    await waitFor(() => expect(openSecondary).toHaveBeenCalledWith("checklist-history"));

    // Spec scenario: app-modes/compact-top-bar — About opens in the secondary window.
    fireEvent.click(screen.getByRole("button", { name: "About" }));
    await waitFor(() => expect(openSecondary).toHaveBeenCalledWith("about"));
  });

  it("starts a session from the compact session block", async () => {
    const start = vi.spyOn(sessionService, "start").mockResolvedValue({
      id: "sess-1",
      label: null,
      started_at: Date.now(),
      ended_at: null,
      total_focus_ms: 0,
      total_distracted_ms: 0,
      total_idle_ms: 0,
      total_alerts: 0,
      notes: null,
      settings_snapshot: "{}",
    });
    render(<CompactShell pinned={false} />);

    fireEvent.click(await screen.findByRole("button", { name: /Start Focus Session/ }));
    await waitFor(() => expect(start).toHaveBeenCalled());
  });

  // Spec scenario: app-modes/fullscreen-follows-full-mode
  it("hides the mode toggle while native fullscreen owns the layout", async () => {
    render(<CompactShell pinned={false} isFullscreen />);

    await screen.findByRole("button", { name: "Settings" });
    expect(screen.queryByRole("button", { name: "Switch to Full Mode" })).not.toBeInTheDocument();
  });
});

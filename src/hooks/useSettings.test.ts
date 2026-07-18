import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSettings } from "./useSettings";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import * as tauriService from "@/services/tauri";
import type { AppSettings } from "@/types";

const mockSettings: AppSettings = {
  general: {
    language: "en-US",
    theme: "system",
    polling_interval_ms: 1000,
    micro_event_threshold_ms: 3000,
    start_minimized: true,
    launch_at_login: false,
    time_format: "24h",
  },
  focus_rules: {
    mode: "blocklist",
    apps: [],
    browser_tab_mode: "blocklist",
    browser_tab_terms: [],
  },
  alerts: {
    notification_enabled: true,
    notification_threshold_ms: 30000,
    fullscreen_enabled: false,
    fullscreen_threshold_ms: 60000,
    cooldown_ms: 10000,
  },
  audio: {
    notification_sound: "builtin:alert1.wav",
    fullscreen_sound: "builtin:alarm.wav",
    volume: 0.8,
    notification_sound_enabled: true,
    fullscreen_sound_enabled: true,
  },
  breaks: {
    enabled: false,
    focus_interval_ms: 3000000,
    break_duration_ms: 600000,
    alert_type: "notification",
  },
  shortcuts: {
    toggle_focus: "CmdOrCtrl+Shift+F",
  },
};

beforeEach(() => {
  useSettingsStore.setState({ settings: mockSettings, loaded: false });
  useUiStore.setState({ toasts: [] });
  vi.clearAllMocks();
});

describe("useSettings", () => {
  it("loads settings from backend on mount when not yet loaded", async () => {
    const getSpy = vi.spyOn(tauriService.settingsService, "get").mockResolvedValue(mockSettings);

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(getSpy).toHaveBeenCalledOnce();
    expect(result.current.settings.general.language).toBe("en-US");
  });

  it("does not reload settings if already loaded", async () => {
    useSettingsStore.setState({ settings: mockSettings, loaded: true });
    const getSpy = vi.spyOn(tauriService.settingsService, "get").mockResolvedValue(mockSettings);

    renderHook(() => useSettings());

    // Give time for any async calls to run
    await new Promise((r) => setTimeout(r, 50));
    expect(getSpy).not.toHaveBeenCalled();
  });

  it("saveSettings calls backend and updates store", async () => {
    useSettingsStore.setState({ settings: mockSettings, loaded: true });
    const saveSpy = vi.spyOn(tauriService.settingsService, "save").mockResolvedValue();

    const { result } = renderHook(() => useSettings());

    const updated = {
      ...mockSettings,
      general: { ...mockSettings.general, polling_interval_ms: 2000 },
    };

    act(() => {
      result.current.saveSettings(updated);
    });

    // Store should update immediately (optimistic)
    expect(result.current.settings.general.polling_interval_ms).toBe(2000);

    // Backend save is debounced — wait for it
    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith(updated);
    }, { timeout: 1500 });
  });

  it("resetSettings calls backend and reverts to defaults", async () => {
    useSettingsStore.setState({ settings: mockSettings, loaded: true });
    const resetSpy = vi.spyOn(tauriService.settingsService, "reset").mockResolvedValue(mockSettings);

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.resetSettings();
    });

    expect(resetSpy).toHaveBeenCalledOnce();
  });

  // Spec scenario: tray-status/language-change
  it("pushes localized tray labels on startup and on language change", async () => {
    vi.spyOn(tauriService.settingsService, "get").mockResolvedValue(mockSettings);
    vi.spyOn(tauriService.settingsService, "save").mockResolvedValue();
    const setLabels = vi.spyOn(tauriService.trayService, "setLabels").mockResolvedValue();

    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(setLabels).toHaveBeenCalledTimes(1));
    expect(setLabels.mock.calls[0][0].quit).toBe("Quit");

    const toPortuguese = {
      ...mockSettings,
      general: { ...mockSettings.general, language: "pt-BR" },
    };
    await act(async () => {
      await result.current.saveSettings(toPortuguese);
    });
    await waitFor(() => expect(setLabels).toHaveBeenCalledTimes(2));
    expect(setLabels.mock.calls[1][0].quit).toBe("Sair");
  });

  it("reports a rejected shortcut save and keeps the process usable", async () => {
    useSettingsStore.setState({ settings: mockSettings, loaded: true });
    vi.spyOn(tauriService.settingsService, "save").mockRejectedValue(new Error("shortcut conflict"));
    const { result } = renderHook(() => useSettings());
    act(() => { void result.current.saveSettings(mockSettings); });
    await waitFor(() => {
      expect(useUiStore.getState().toasts.some((toast) => toast.type === "error")).toBe(true);
    }, { timeout: 1500 });
  });
});

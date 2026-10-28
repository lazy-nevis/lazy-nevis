import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { CommandPalette } from "./CommandPalette";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: useSettingsStore.getState().settings,
    loaded: true,
    saveSettings: vi.fn(),
    resetSettings: vi.fn(),
  }),
}));

beforeEach(async () => {
  await i18n.changeLanguage("en-US");
  useSessionStore.setState({ activeSession: null });
  useSettingsStore.setState({ loaded: true });
  useUiStore.setState({ isCommandPaletteOpen: true });
});

describe("CommandPalette", () => {
  it("filters navigation case-insensitively", () => {
    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "hist" } });
    expect(screen.getByRole("option", { name: "History" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  it("hides start session when a session is active", () => {
    useSessionStore.setState({
      activeSession: {
        id: "s1",
        label: "Deep work",
        started_at: Date.now(),
        ended_at: null,
        total_focus_ms: 0,
        total_distracted_ms: 0,
        total_idle_ms: 0,
        total_alerts: 0,
        notes: null,
        settings_snapshot: "{}",
      },
    });

    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("option", { name: "Start session" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Stop session" })).toBeInTheDocument();
  });
});

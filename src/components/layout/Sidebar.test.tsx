import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/i18n";
import { useAppStatusStore } from "@/stores/appStatusStore";
import { useChecklistStore } from "@/stores/checklistStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { Sidebar } from "./Sidebar";

beforeEach(async () => {
  await i18n.changeLanguage("en-US");
  useSessionStore.setState({ activeSession: null });
  useAppStatusStore.setState({ mode: "full", pinned: false, isFullscreen: false, hydrated: true });
  useSettingsStore.setState({
    loaded: true,
    settings: { ...useSettingsStore.getState().settings, ui: { sidebar_collapsed: false } },
  });
  useChecklistStore.setState({ openItems: [] });
});

describe("Sidebar", () => {
  // Spec scenario: app-modes/fullscreen-follows-full-mode
  it("hides the compact-mode toggle while native fullscreen owns the layout", async () => {
    useAppStatusStore.setState({ isFullscreen: true });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(await screen.findByTitle("Settings")).toBeInTheDocument();
    expect(screen.queryByTitle("Switch to Compact Mode")).not.toBeInTheDocument();
  });

  it("shows the compact-mode toggle outside fullscreen", async () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(await screen.findByTitle("Switch to Compact Mode")).toBeInTheDocument();
  });

  it("shows checklist open count badge when expanded", async () => {
    useChecklistStore.setState({
      openItems: [
        {
          id: "1",
          title: "One",
          completed_at: null,
          created_at: 0,
          due_date: null,
          due_has_time: false,
          sort_order: 0,
          parent_id: null,
          category: null,
          priority: "none",
          tags: [],
        },
        {
          id: "2",
          title: "Two",
          completed_at: null,
          created_at: 0,
          due_date: null,
          due_has_time: false,
          sort_order: 1,
          parent_id: null,
          category: null,
          priority: "none",
          tags: [],
        },
      ],
    });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(await screen.findByText("2")).toBeInTheDocument();
  });
});

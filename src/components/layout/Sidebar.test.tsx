import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/i18n";
import { useAppStatusStore } from "@/stores/appStatusStore";
import { useSessionStore } from "@/stores/sessionStore";
import { Sidebar } from "./Sidebar";

beforeEach(async () => {
  await i18n.changeLanguage("en-US");
  useSessionStore.setState({ activeSession: null });
  useAppStatusStore.setState({ mode: "full", pinned: false, isFullscreen: false, hydrated: true });
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
});

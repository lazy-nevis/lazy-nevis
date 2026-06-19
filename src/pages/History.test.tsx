import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/i18n";
import { sessionService } from "@/services/tauri";
import { useUiStore } from "@/stores/uiStore";
import type { SessionSummary } from "@/types";
import { History } from "./History";

const session: SessionSummary = {
  id: "session-1",
  label: "Deep Work",
  started_at: new Date("2026-06-19T12:00:00Z").getTime(),
  ended_at: new Date("2026-06-19T13:00:00Z").getTime(),
  total_focus_ms: 3_000_000,
  total_distracted_ms: 300_000,
  total_idle_ms: 300_000,
  total_alerts: 1,
  focus_percent: 83.3,
};

describe("History", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("en-US");
    useUiStore.setState({ toasts: [] });
    vi.spyOn(sessionService, "list").mockResolvedValue([]);
    vi.spyOn(sessionService, "listByRange").mockResolvedValue([]);
  });

  it("renders the empty state and reports load failures", async () => {
    const list = vi.mocked(sessionService.list);
    list.mockRejectedValueOnce(new Error("database unavailable"));

    render(<History />);

    expect(await screen.findByText("No sessions found. Start your first session!")).toBeInTheDocument();
    expect(useUiStore.getState().toasts.some((toast) => toast.type === "error")).toBe(true);
  });

  it("filters loaded sessions by label and clears the search accessibly", async () => {
    vi.mocked(sessionService.list).mockResolvedValueOnce([session]);
    render(<History />);

    expect(await screen.findByText("Deep Work")).toBeInTheDocument();
    const search = screen.getByPlaceholderText("Search by label or note...");
    fireEvent.change(search, { target: { value: "missing" } });
    expect(screen.getByText('No sessions match "missing"')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear history search" }));
    expect(screen.getByText("Deep Work")).toBeInTheDocument();
  });

  it("uses the date-range service when a date filter changes", async () => {
    render(<History />);
    await screen.findByText("No sessions found. Start your first session!");

    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    await waitFor(() => expect(sessionService.listByRange).toHaveBeenCalledOnce());
  });

  it("deletes a session only after confirmation", async () => {
    vi.mocked(sessionService.list).mockResolvedValueOnce([session]);
    const deleteSession = vi.spyOn(sessionService, "delete").mockResolvedValue();
    render(<History />);
    await screen.findByText("Deep Work");

    fireEvent.click(screen.getByRole("button", { name: "Delete session Deep Work" }));
    expect(deleteSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete", exact: true }));

    await waitFor(() => expect(deleteSession).toHaveBeenCalledWith("session-1"));
    expect(screen.queryByText("Deep Work")).not.toBeInTheDocument();
  });
});

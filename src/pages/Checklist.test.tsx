import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/i18n";
import { checklistService, settingsService } from "@/services/tauri";
import { useChecklistStore } from "@/stores/checklistStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ChecklistItem } from "@/types";
import { Checklist } from "./Checklist";

function makeItem(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: "item-1",
    title: "Write report",
    created_at: Date.now(),
    completed_at: null,
    due_date: null,
    sort_order: 1,
    tags: [],
    ...overrides,
  };
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage("en-US");
  const settings = useSettingsStore.getState().settings;
  useSettingsStore.setState({ settings, loaded: true });
  useChecklistStore.setState({ openItems: [], historyItems: [], allTags: [] });
  useSessionStore.setState({ activeSession: null });
  vi.spyOn(settingsService, "get").mockResolvedValue(settings);
  // The hook refreshes from the backend on mount; echo the seeded store back
  // so tests can arrange state via useChecklistStore.setState.
  vi.spyOn(checklistService, "listOpen").mockImplementation(async () =>
    useChecklistStore.getState().openItems,
  );
  vi.spyOn(checklistService, "listHistory").mockResolvedValue([]);
  vi.spyOn(checklistService, "listTags").mockResolvedValue([]);
});

describe("Checklist page", () => {
  // Spec scenario: daily-checklist/rapid-entry + inline-tags
  it("creates an item on Enter, parsing inline #tags", async () => {
    const create = vi
      .spyOn(checklistService, "create")
      .mockResolvedValue(makeItem());
    render(<Checklist />);

    fireEvent.click(await screen.findByRole("button", { name: "Add item" }));
    const input = screen.getByPlaceholderText(/What needs doing/);
    fireEvent.change(input, { target: { value: "Review PR #work #urgent" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith("Review PR", ["work", "urgent"], undefined),
    );
    // Input stays ready for the next item.
    expect(screen.getByPlaceholderText(/What needs doing/)).toBeInTheDocument();
  });

  // Spec scenario: daily-checklist/abandoned-empty-line
  it("collapses an empty entry line on blur", async () => {
    render(<Checklist />);

    fireEvent.click(await screen.findByRole("button", { name: "Add item" }));
    const input = screen.getByPlaceholderText(/What needs doing/);
    fireEvent.blur(input);

    expect(screen.queryByPlaceholderText(/What needs doing/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add item" })).toBeInTheDocument();
  });

  // Spec scenario: daily-checklist/complete-and-wait + undo-during-grace
  it("shows the grace countdown for a just-completed item and undoes it", async () => {
    const item = makeItem({ completed_at: Date.now() - 1_000 });
    useChecklistStore.setState({ openItems: [item] });
    const uncomplete = vi
      .spyOn(checklistService, "uncomplete")
      .mockResolvedValue(makeItem());
    render(<Checklist />);

    // Both the checkbox (aria-label) and the countdown button expose "Undo".
    const undoButtons = await screen.findAllByRole("button", { name: /Undo/ });
    expect(undoButtons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(undoButtons[undoButtons.length - 1]);
    await waitFor(() => expect(uncomplete).toHaveBeenCalledWith("item-1"));
  });

  it("completes an open item via its checkbox", async () => {
    useChecklistStore.setState({ openItems: [makeItem()] });
    const complete = vi
      .spyOn(checklistService, "complete")
      .mockResolvedValue(makeItem({ completed_at: Date.now() }));
    render(<Checklist />);

    fireEvent.click(await screen.findByRole("button", { name: "Mark as done" }));
    await waitFor(() => expect(complete).toHaveBeenCalledWith("item-1"));
  });

  // Spec scenario: daily-checklist/confirmed-delete
  it("requires confirmation before deleting", async () => {
    useChecklistStore.setState({ openItems: [makeItem()] });
    const del = vi.spyOn(checklistService, "delete").mockResolvedValue();
    render(<Checklist />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(del).not.toHaveBeenCalled();
    expect(screen.getByText("Delete item?")).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    await waitFor(() => expect(del).toHaveBeenCalledWith("item-1"));
  });

  // Spec scenario: daily-checklist/overdue-highlight
  it("highlights overdue items", async () => {
    const yesterday = Date.now() - 36 * 60 * 60 * 1000;
    useChecklistStore.setState({ openItems: [makeItem({ due_date: yesterday })] });
    render(<Checklist />);

    expect(await screen.findByText(/overdue/)).toBeInTheDocument();
  });

  // Spec scenario: daily-checklist/start-from-item
  it("starts a focus session from an item", async () => {
    useChecklistStore.setState({ openItems: [makeItem()] });
    const { sessionService } = await import("@/services/tauri");
    const start = vi.spyOn(sessionService, "start").mockResolvedValue({
      id: "sess-9",
      label: "Write report",
      started_at: Date.now(),
      ended_at: null,
      total_focus_ms: 0,
      total_distracted_ms: 0,
      total_idle_ms: 0,
      total_alerts: 0,
      notes: null,
      settings_snapshot: "{}",
    });
    const link = vi.spyOn(checklistService, "linkSession").mockResolvedValue();
    render(<Checklist />);

    fireEvent.click(await screen.findByRole("button", { name: "Start focus session" }));
    await waitFor(() => expect(start).toHaveBeenCalledWith("Write report"));
    await waitFor(() => expect(link).toHaveBeenCalledWith("item-1", "sess-9"));
  });

  // Spec scenario: daily-checklist/hidden-while-a-session-runs
  it("hides the start-focus action while a session is active", async () => {
    useChecklistStore.setState({ openItems: [makeItem()] });
    useSessionStore.setState({
      activeSession: {
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
      },
    });
    render(<Checklist />);

    await screen.findByTestId("checklist-row-item-1");
    expect(screen.queryByRole("button", { name: "Start focus session" })).not.toBeInTheDocument();
  });

  // Spec scenario: daily-checklist/drag-reorder-previews-live
  it("previews reorder while dragging and persists once on drop", async () => {
    const items = [
      makeItem({ id: "a", title: "A", sort_order: 1 }),
      makeItem({ id: "b", title: "B", sort_order: 2 }),
      makeItem({ id: "c", title: "C", sort_order: 3 }),
    ];
    useChecklistStore.setState({ openItems: items });
    const reorder = vi.spyOn(checklistService, "reorder").mockResolvedValue();
    render(<Checklist />);

    const rowA = await screen.findByTestId("checklist-row-a");
    const rowC = await screen.findByTestId("checklist-row-c");

    fireEvent.dragStart(rowA);
    fireEvent.dragOver(rowC);
    // Live preview: local order already changed, nothing persisted yet.
    expect(useChecklistStore.getState().openItems.map((i) => i.id)).toEqual(["b", "c", "a"]);
    expect(reorder).not.toHaveBeenCalled();

    fireEvent.dragEnd(rowA);
    await waitFor(() => expect(reorder).toHaveBeenCalledWith(["b", "c", "a"]));
  });
});

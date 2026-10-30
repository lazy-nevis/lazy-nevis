import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@/i18n";
import { EntryMenuPanel } from "./EntryMenu";

function setup(close = vi.fn()) {
  render(
    <EntryMenuPanel
      initialView="due"
      close={close}
      categories={[]}
      allowCategory={false}
      category={null}
      onCategory={vi.fn()}
      priority="none"
      onPriority={vi.fn()}
      due={null}
      onDue={vi.fn()}
      onAddTag={vi.fn()}
    />,
  );
  return close;
}

afterEach(() => {
  Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
});

describe("EntryMenuPanel due view", () => {
  it("opens as a full-window modal with a close button in narrow windows", () => {
    Object.defineProperty(window, "innerWidth", { value: 340, configurable: true });
    const close = setup();
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("fixed inset-0");
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(close).toHaveBeenCalled();
  });

  it("stays an inline panel in wide windows", () => {
    setup();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

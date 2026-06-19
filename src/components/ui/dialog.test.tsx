import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog, DialogTitle } from "./dialog";

describe("Dialog", () => {
  it("focuses content, traps tab, closes on Escape, and restores focus", () => {
    const onClose = vi.fn();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { unmount } = render(
      <Dialog open onClose={onClose}>
        <DialogTitle>Confirm action</DialogTitle>
        <button>First</button>
        <button>Last</button>
      </Dialog>,
    );
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    screen.getByRole("button", { name: "Last" }).focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});

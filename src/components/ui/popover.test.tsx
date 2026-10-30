import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Popover } from "./popover";

describe("Popover", () => {
  it("shrinks a panel wider than the window instead of letting it clip", () => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(400);
    Object.defineProperty(window, "innerWidth", { value: 340, configurable: true });
    render(<Popover trigger="open">{() => <div>panel</div>}</Popover>);
    fireEvent.click(screen.getByRole("button"));
    const panel = screen.getByRole("dialog");
    expect(Number(panel.style.zoom)).toBeCloseTo((340 - 16) / 400, 2);
    vi.restoreAllMocks();
  });
});

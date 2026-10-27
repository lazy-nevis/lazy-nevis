import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DropdownMenu } from "./dropdown-menu";

describe("DropdownMenu", () => {
  it("opens with arrow down and selects with Enter", () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu
        trigger={<span>Menu</span>}
        items={[
          { id: "one", label: "One", onSelect },
          { id: "two", label: "Two", onSelect: vi.fn() },
        ]}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Menu" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const one = screen.getByRole("menuitem", { name: "One" });
    expect(one).toBeInTheDocument();
    fireEvent.keyDown(one, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("closes on Escape", () => {
    render(
      <DropdownMenu
        trigger={<span>Open</span>}
        items={[{ id: "a", label: "A", onSelect: vi.fn() }]}
      />,
    );
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);
    const item = screen.getByRole("menuitem", { name: "A" });
    fireEvent.keyDown(item, { key: "Escape" });
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });
});

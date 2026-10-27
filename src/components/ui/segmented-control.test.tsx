import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./segmented-control";

describe("SegmentedControl", () => {
  it("supports keyboard navigation and selection", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="Sections"
        value="a"
        onChange={onChange}
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
      />,
    );
    const a = screen.getByRole("radio", { name: "A" });
    const b = screen.getByRole("radio", { name: "B" });
    a.focus();
    fireEvent.keyDown(a, { key: "ArrowRight" });
    expect(b).toHaveFocus();
    fireEvent.click(b);
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

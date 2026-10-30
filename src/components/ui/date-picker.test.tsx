import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@/i18n";
import { DateTimePanel } from "./date-picker";

describe("DateTimePanel", () => {
  it("commits a manually typed time", () => {
    const onChange = vi.fn();
    render(<DateTimePanel date={new Date(2026, 9, 29)} time="09:00" onChange={onChange} />);
    const input = screen.getByPlaceholderText("HH:MM");
    fireEvent.change(input, { target: { value: "14:35" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(expect.any(Date), "14:35");
  });

  it("builds minute columns from the chosen step", () => {
    render(<DateTimePanel date={new Date(2026, 9, 29)} time="09:00" minuteStep={15} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "45" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "50" })).not.toBeInTheDocument();
  });

  it("hides time controls when withTime is off", () => {
    render(<DateTimePanel date={null} time={null} withTime={false} onChange={vi.fn()} />);
    expect(screen.queryByPlaceholderText("HH:MM")).not.toBeInTheDocument();
  });
});

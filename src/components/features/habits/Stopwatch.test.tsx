import { act, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { Stopwatch } from "@/components/features/habits/Stopwatch";

describe("Stopwatch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates minutes while running", () => {
    const onMinutesChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <Stopwatch onMinutesChange={onMinutesChange} />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /start/i }));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onMinutesChange).toHaveBeenCalled();
    const last = onMinutesChange.mock.calls.at(-1)?.[0] as number;
    expect(last).toBeGreaterThan(0.9);
  });
});

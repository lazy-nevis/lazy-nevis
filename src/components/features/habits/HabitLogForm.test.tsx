import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { HabitLogForm } from "@/components/features/habits/HabitLogForm";
import type { Habit } from "@/types";

const habit: Habit = {
  id: "h1",
  name: "Water",
  description: null,
  tone: "emerald",
  icon: "droplet",
  period: "daily",
  active: true,
  skip_reminders_when_met: true,
  channels: null,
  sound: null,
  sort_order: 0,
  created_at: 0,
  updated_at: 0,
  targets: [
    {
      id: "t1",
      habit_id: "h1",
      metric: "volume",
      unit: "ml",
      target_value: 2000,
      sort_order: 0,
      archived_at: null,
    },
  ],
  schedules: [],
};

describe("HabitLogForm", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-10-26T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies quick-add chips", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nextProvider i18n={i18n}>
        <HabitLogForm habit={habit} source="dialog" onSubmit={onSubmit} />
      </I18nextProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+250" }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          values: [{ target_id: "t1", value: 250 }],
        }),
      ),
    );
  });

  it("allows backdated timestamps", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nextProvider i18n={i18n}>
        <HabitLogForm habit={habit} source="dialog" onSubmit={onSubmit} />
      </I18nextProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /more options/i }));
    await user.click(await screen.findByRole("button", { name: /pick date & time/i }));
    await user.click(screen.getByRole("button", { name: /previous month/i }));
    await user.click(screen.getByRole("button", { name: "1" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "+500" }));
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onSubmit).toHaveBeenCalled();
    const loggedAt = onSubmit.mock.calls[0][0].logged_at as number;
    expect(loggedAt).toBeLessThan(Date.now());
  });

  it("steps with the + and - buttons and never goes below zero", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nextProvider i18n={i18n}>
        <HabitLogForm habit={habit} source="dialog" onSubmit={onSubmit} />
      </I18nextProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /decrease volume/i }));
    await user.click(screen.getByRole("button", { name: /increase volume/i }));
    await user.click(screen.getByRole("button", { name: /increase volume/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ values: [{ target_id: "t1", value: 100 }] }),
      ),
    );
  });

  it("saves a typed value with Enter, accepting a comma decimal", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nextProvider i18n={i18n}>
        <HabitLogForm habit={habit} source="dialog" onSubmit={onSubmit} />
      </I18nextProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /tap to type/i }));
    await user.keyboard("333,5{Enter}");
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ values: [{ target_id: "t1", value: 333.5 }] }),
      ),
    );
  });

  // Regression: the form used to re-seed its values from `targets`/`initialValues` identity, so any
  // parent re-render with a re-fetched habit (new objects, same content) wiped what the user typed.
  it("keeps entered values when the parent re-renders with a re-fetched habit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const ui = (h: Habit) => (
      <I18nextProvider i18n={i18n}>
        <HabitLogForm habit={h} source="dialog" onSubmit={onSubmit} initialValues={[]} />
      </I18nextProvider>
    );
    const { rerender } = render(ui(habit));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+250" }));
    rerender(ui(structuredClone(habit)));
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ values: [{ target_id: "t1", value: 250 }] }),
      ),
    );
  });

  // Regression: an inline Stopwatch callback re-fired on every render and reset duration to "".
  it("does not wipe a duration value when the form re-renders", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const durationHabit: Habit = {
      ...habit,
      targets: [{ ...habit.targets[0], metric: "duration", unit: "min", target_value: 30 }],
    };
    render(
      <I18nextProvider i18n={i18n}>
        <HabitLogForm habit={durationHabit} source="dialog" onSubmit={onSubmit} />
      </I18nextProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+15" }));
    await user.click(screen.getByRole("button", { name: "+10" }));
    await act(async () => {});
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ values: [{ target_id: "t1", value: 25 }] }),
      ),
    );
  });
});

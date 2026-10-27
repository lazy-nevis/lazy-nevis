import { render, screen, waitFor } from "@testing-library/react";
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
    await user.click(screen.getByRole("button", { name: /pick date & time/i }));
    await user.click(screen.getByRole("button", { name: /previous month/i }));
    await user.click(screen.getByRole("button", { name: "1" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "+500" }));
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onSubmit).toHaveBeenCalled();
    const loggedAt = onSubmit.mock.calls[0][0].logged_at as number;
    expect(loggedAt).toBeLessThan(Date.now());
  });
});

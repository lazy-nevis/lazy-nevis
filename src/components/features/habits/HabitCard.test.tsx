import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { HabitCard } from "@/components/features/habits/HabitCard";
import type { HabitTodayCard } from "@/types";

const celebrate = vi.hoisted(() => vi.fn());
vi.mock("@/components/ui/motion/celebrate", () => ({ celebrate }));

function makeCard(metric: "check" | "volume", status: string): HabitTodayCard {
  return {
    habit: {
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
        { id: "t1", habit_id: "h1", metric, unit: "", target_value: 1, sort_order: 0, archived_at: null },
      ],
      schedules: [],
    },
    progress: { status, percent: status === "met" ? 100 : 0, per_target: [] },
    streak_current: 0,
  } as unknown as HabitTodayCard;
}

const noop = () => undefined;

function ui(card: HabitTodayCard) {
  return (
    <I18nextProvider i18n={i18n}>
      <HabitCard
        card={card}
        onLog={noop}
        onMarkDone={noop}
        onEdit={noop}
        onToggleActive={noop}
        onOpenHistory={noop}
      />
    </I18nextProvider>
  );
}

describe("HabitCard met state", () => {
  it("shows Mark done while pending and a Done badge once met (check-only)", () => {
    const { rerender } = render(ui(makeCard("check", "pending")));
    expect(screen.getByRole("button", { name: /mark done/i })).toBeInTheDocument();
    rerender(ui(makeCard("check", "met")));
    expect(screen.queryByRole("button", { name: /mark done/i })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/done today/i);
  });

  it("keeps Log available on met non-check habits", () => {
    render(ui(makeCard("volume", "met")));
    expect(screen.getByRole("button", { name: /^log$/i })).toBeInTheDocument();
  });

  it("celebrates only on a not-met to met transition, not on first mount", () => {
    celebrate.mockClear();
    const { rerender } = render(ui(makeCard("check", "met")));
    expect(celebrate).not.toHaveBeenCalled();
    rerender(ui(makeCard("check", "pending")));
    rerender(ui(makeCard("check", "met")));
    expect(celebrate).toHaveBeenCalledTimes(1);
  });
});

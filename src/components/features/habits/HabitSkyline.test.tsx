import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";

vi.mock("@/components/ui/contribution-skyline", () => ({
  ContributionSkyline: ({
    labels,
    onCellClick,
  }: {
    labels: { noData: string };
    onCellClick?: (day: { date: string; count: number }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onCellClick?.({ date: "2024-06-01", count: 2 })}
    >
      {labels.noData}
    </button>
  ),
}));

import { HabitSkyline } from "@/components/features/habits/HabitSkyline";

describe("HabitSkyline", () => {
  it("forwards cell clicks and shows localized empty label via wrapper", async () => {
    const onDayClick = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <HabitSkyline
          points={[{ date: "2024-06-01", value: 2 }]}
          weekStart={1}
          unit="times"
          habitId="h1"
          logs={[]}
          onDayClick={onDayClick}
        />
      </I18nextProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button"));
    expect(onDayClick).toHaveBeenCalledWith("2024-06-01");
  });
});

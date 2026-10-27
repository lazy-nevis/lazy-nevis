import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  buildGrid,
  ContributionSkyline,
  type ContributionSkylineLabels,
} from "@/components/ui/contribution-skyline";

const labels: ContributionSkylineLabels = {
  noData: "Empty label",
  chartViewAria: "Chart aria",
  viewFlatAria: "2D label",
  view3dAria: "3D label",
  hintHeatmap: "Heatmap hint",
  hintOrbit: "Orbit hint",
  less: "Less label",
  more: "More label",
  statYearTotal: "Year",
  statBusiestDay: "Busiest",
  statLongestStreak: "Longest",
  statCurrentStreak: "Current",
  day: "day",
  days: "days",
  levelNo: "No unit",
  levelLight: "Light",
  levelModerate: "Moderate",
  levelHeavy: "Heavy",
  levelHeaviest: "Heaviest",
  highlightLevel: (level) => `Highlight ${level}`,
  formatCellAnnounce: (count, unit, date) => `${count} ${unit} @ ${date}`,
  formatCellTooltip: (count, unit, date) => `${count} ${unit} @ ${date}`,
  formatAriaChart: (total, unit, range, is3d) => `${total} ${unit} ${range} ${is3d ? "3d" : "2d"}`,
};

describe("buildGrid", () => {
  it("places contributions on the expected week/day", () => {
    const end = Date.UTC(2024, 0, 7);
    const grid = buildGrid([{ date: "2024-01-01", count: 3 }], end, 1);
    const cell = grid.cells.find((c) => c.date === "2024-01-01");
    expect(cell?.count).toBe(3);
    expect(cell?.level).toBeGreaterThan(0);
  });
});

describe("ContributionSkyline", () => {
  it("uses provided labels", () => {
    render(
      <ContributionSkyline
        data={[{ date: "2024-01-01", count: 2 }]}
        palette={["#111", "#222", "#333", "#444"]}
        weekStart={1}
        unit="times"
        labels={labels}
        defaultView="2d"
        reducedMotion
      />,
    );
    expect(screen.getByRole("button", { name: "2D label" })).toBeInTheDocument();
    expect(screen.getByText("Less label")).toBeInTheDocument();
  });

  it("shows no-data label when data is empty", () => {
    render(
      <ContributionSkyline
        data={[]}
        palette={["#111", "#222", "#333", "#444"]}
        weekStart={1}
        unit="times"
        labels={labels}
        reducedMotion
      />,
    );
    expect(screen.getByText("Empty label")).toBeInTheDocument();
  });

  it("exposes canvas keyboard surface for navigation", () => {
    render(
      <ContributionSkyline
        data={[{ date: "2024-01-01", count: 2 }]}
        palette={["#111", "#222", "#333", "#444"]}
        weekStart={1}
        unit="times"
        labels={labels}
        defaultView="2d"
        reducedMotion
      />,
    );
    const canvas = screen.getByRole("img");
    fireEvent.keyDown(canvas, { key: "ArrowRight" });
    expect(canvas).toHaveAttribute("tabindex", "0");
  });
});

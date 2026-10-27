import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PomodoroControls } from "./PomodoroControls";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("PomodoroControls", () => {
  it("shows start when idle", () => {
    render(
      <PomodoroControls
        runState={null}
        hasRun={false}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSkip={vi.fn()}
        onStop={vi.fn()}
        onStartNext={vi.fn()}
      />,
    );
    expect(screen.getByText("controls.start")).toBeInTheDocument();
  });

  it("shows pause when running", () => {
    render(
      <PomodoroControls
        runState="running"
        hasRun={true}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSkip={vi.fn()}
        onStop={vi.fn()}
        onStartNext={vi.fn()}
      />,
    );
    expect(screen.getByText("controls.pause")).toBeInTheDocument();
  });

  it("shows start next when awaiting", () => {
    render(
      <PomodoroControls
        runState="awaiting"
        hasRun={true}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSkip={vi.fn()}
        onStop={vi.fn()}
        onStartNext={vi.fn()}
      />,
    );
    expect(screen.getByText("controls.start_next")).toBeInTheDocument();
  });
});

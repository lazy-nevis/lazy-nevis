import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { Sidebar } from "@/components/layout/Sidebar";
import { resetUpdateStoreForTests, useUpdateStore } from "@/stores/updateStore";
import { UpdateAlert } from "./UpdateAlert";

vi.mock("@/hooks/useSidebarCollapsed", () => ({
  useSidebarCollapsed: () => ({ effectiveCollapsed: false, toggleCollapsed: vi.fn() }),
}));
vi.mock("@/hooks/useHabits", () => ({ useHabits: () => ({ habits: [], loading: false }) }));

const release = { version: "0.10.0-rc.5", url: "https://github.com/lazy-nevis/lazy-nevis/releases/tag/v0.10.0-rc.5" };

describe("UpdateAlert", () => {
  beforeEach(() => resetUpdateStoreForTests());

  it("renders nothing without an update", () => {
    render(<MemoryRouter><UpdateAlert /></MemoryRouter>);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the version and can be dismissed", async () => {
    useUpdateStore.getState().setRelease(release);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<UpdateAlert />} />
          <Route path="/about" element={<p>about page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Version 0.10.0-rc.5 is available")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(useUpdateStore.getState().dismissedVersion).toBe("0.10.0-rc.5");
    await waitFor(() => expect(screen.queryByText("Version 0.10.0-rc.5 is available")).toBeNull());
  });

  it("'View details' opens About", () => {
    useUpdateStore.getState().setRelease(release);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<UpdateAlert />} />
          <Route path="/about" element={<p>about page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByText("about page")).toBeInTheDocument();
  });
});

describe("Sidebar update badge", () => {
  beforeEach(() => resetUpdateStoreForTests());

  it("shows the badge while unseen and hides it once seen", () => {
    useUpdateStore.getState().setRelease(release);
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByTestId("update-badge")).toBeInTheDocument();
    act(() => useUpdateStore.getState().markSeen());
    expect(screen.queryByTestId("update-badge")).toBeNull();
  });
});

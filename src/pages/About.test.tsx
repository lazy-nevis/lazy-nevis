import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openUrl } from "@tauri-apps/plugin-opener";
import "@/i18n";
import { About } from "./About";

vi.mock("@/services/updates", () => ({
  checkForUpdate: vi.fn(() => Promise.resolve({
    version: "0.1.0-rc.2",
    url: "https://github.com/lazy-nevis/lazy-nevis/releases/tag/v0.1.0-rc.2",
  })),
}));

describe("About", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  });

  it("shows runtime version and a manual update result", async () => {
    render(<About />);
    expect(await screen.findByText(/0\.1\.0-rc\.1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check for updates" }));
    expect(await screen.findByText("Version 0.1.0-rc.2 is available.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open release page" })).toBeInTheDocument();
  });

  it("opens the approved donation URL", async () => {
    render(<About />);
    fireEvent.click(screen.getByRole("button", { name: "Buy me a coffee" }));
    await waitFor(() => expect(openUrl).toHaveBeenCalledWith("https://www.buymeacoffee.com/simstm"));
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { overlayService } from "@/services/tauri";
import type { OverlayAlertPayload } from "@/types";
import { Overlay } from "./Overlay";

const { listenMock } = vi.hoisted(() => ({
  listenMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

const activePayload: OverlayAlertPayload = {
  session_id: "test-session",
  app_name: "Instagram",
  window_title: null,
  distracted_ms: 65_000,
  session_elapsed_ms: 120_000,
  focus_ms: 55_000,
  idle_ms: 0,
  alert_started_at_ms: Date.now(),
  is_test: true,
  language: "pt-BR",
  time_format: "24h",
};

describe("Overlay", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    listenMock.mockReset();
    listenMock.mockResolvedValue(() => {});
    await i18n.changeLanguage("en-US");
  });

  it("restores the active payload after the WebView mounts again", async () => {
    vi.spyOn(overlayService, "getActive").mockResolvedValue(activePayload);

    render(<Overlay />);

    expect(await screen.findByText("VOCÊ PERDEU O FOCO")).toBeInTheDocument();
    expect(screen.getByText("Você está em: Instagram")).toBeInTheDocument();
  });

  it("dismisses the active overlay when Escape is pressed", async () => {
    vi.spyOn(overlayService, "getActive").mockResolvedValue(activePayload);
    const dismiss = vi.spyOn(overlayService, "dismiss").mockResolvedValue();

    render(<Overlay />);
    await screen.findByText("VOCÊ PERDEU O FOCO");

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(dismiss).toHaveBeenCalledOnce());
  });
});

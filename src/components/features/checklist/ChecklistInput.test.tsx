import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/i18n";
import { ChecklistInput } from "./ChecklistInput";
import { useSettingsStore } from "@/stores/settingsStore";

beforeEach(async () => {
  await i18n.changeLanguage("en-US");
  const settings = useSettingsStore.getState().settings;
  useSettingsStore.setState({
    settings: { ...settings, checklist: { ...settings.checklist, date_recognition: true } },
  });
});

describe("ChecklistInput", () => {
  it("highlights date and shows reject chip", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<ChecklistInput onCreate={onCreate} autoFocus />);
    const input = screen.getByPlaceholderText(/What needs doing/);
    fireEvent.change(input, { target: { value: "Ship até 03/11" } });
    expect(screen.getByLabelText(/Ignore recognized date/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Ignore recognized date/i));
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Ship até 03/11", dueDate: null }),
      ),
    );
  });
});

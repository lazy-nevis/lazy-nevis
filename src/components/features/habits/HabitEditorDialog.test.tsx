import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { HabitEditorDialog } from "@/components/features/habits/HabitEditorDialog";
import { validateTargetCount } from "@/components/features/habits/habitFormat";

function renderEditor() {
  return render(
    <I18nextProvider i18n={i18n}>
      <HabitEditorDialog
        open
        habit={null}
        weekStart={1}
        locale="en-US"
        defaultChannels={{ notification: true, fullscreen: false, sound: true }}
        defaultSound="default"
        builtinSounds={["default"]}
        onClose={() => undefined}
        onSave={vi.fn()}
      />
    </I18nextProvider>,
  );
}

describe("HabitEditorDialog", () => {
  it("renders editor fields and enforces target count rules", () => {
    renderEditor();
    expect(screen.getByRole("heading", { name: /targets/i })).toBeInTheDocument();
    expect(validateTargetCount(0)).toBe(false);
    expect(validateTargetCount(3)).toBe(true);
  });
});

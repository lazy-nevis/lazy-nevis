import { describe, it, expect } from "vitest";
import { findKnownConflict } from "./knownShortcutConflicts";

// Spec scenario: global-shortcuts/choosing-a-risky-combination
describe("findKnownConflict", () => {
  it("flags the old default bindings", () => {
    expect(findKnownConflict("CmdOrCtrl+Shift+F")).toContain("VS Code");
    expect(findKnownConflict("CmdOrCtrl+Shift+S")).toBeTruthy();
    expect(findKnownConflict("CmdOrCtrl+Shift+O")).toBeTruthy();
    expect(findKnownConflict("CmdOrCtrl+Shift+C")).toBeTruthy();
  });

  it("does not flag the new triple-modifier defaults", () => {
    for (const key of ["F", "S", "O", "C"]) {
      expect(findKnownConflict(`CmdOrCtrl+Alt+Shift+${key}`)).toBeNull();
    }
  });

  it("normalizes case and modifier order", () => {
    expect(findKnownConflict("shift+cmdorctrl+f")).toContain("VS Code");
    expect(findKnownConflict("Cmd+Shift+F")).toContain("VS Code");
  });

  it("returns null for empty or unlisted combos", () => {
    expect(findKnownConflict("")).toBeNull();
    expect(findKnownConflict("CmdOrCtrl+Alt+Shift+9")).toBeNull();
  });
});

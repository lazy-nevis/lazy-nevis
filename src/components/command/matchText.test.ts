import { describe, expect, it } from "vitest";
import { matchText, normalizeMatchText } from "./matchText";

describe("matchText", () => {
  it("matches case-insensitively", () => {
    expect(matchText("History", "hist")).toBe(true);
  });

  it("matches without diacritics", () => {
    expect(normalizeMatchText("Sessão")).toBe("sessao");
    expect(matchText("Sessão", "sessao")).toBe(true);
  });

  it("returns true for empty query", () => {
    expect(matchText("Anything", "  ")).toBe(true);
  });
});

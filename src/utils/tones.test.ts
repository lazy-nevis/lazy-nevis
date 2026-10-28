import { describe, expect, it } from "vitest";
import { DEFAULT_TONE, isTone, toTone, toneColor, toneStyle } from "./tones";

describe("tones", () => {
  it("accepts only known tone names", () => {
    expect(isTone("emerald")).toBe(true);
    expect(isTone("chartreuse")).toBe(false);
    expect(isTone(42)).toBe(false);
  });

  it("falls back to the default tone for unknown values", () => {
    expect(toTone("rose")).toBe("rose");
    expect(toTone("nope")).toBe(DEFAULT_TONE);
    expect(toTone(null)).toBe(DEFAULT_TONE);
  });

  it("builds css colors and the --tone binding", () => {
    expect(toneColor("sky")).toBe("hsl(var(--tone-sky))");
    expect(toneColor("sky", 0.2)).toBe("hsl(var(--tone-sky) / 0.2)");
    expect(toneStyle("violet")).toEqual({ "--tone": "var(--tone-violet)" });
  });
});

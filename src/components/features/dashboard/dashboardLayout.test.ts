import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, moveWidget, nextSize, parseLayout } from "./dashboardLayout";

describe("dashboardLayout", () => {
  it("falls back to defaults for missing or malformed input", () => {
    expect(parseLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout("{not json")).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout("42")).toEqual(DEFAULT_LAYOUT);
  });

  it("keeps a valid order, drops unknown ids and appends missing ones", () => {
    const layout = parseLayout(
      JSON.stringify({ order: ["habits", "bogus", "hero", "habits"], sizes: { hero: "sm", x: "lg" } }),
    );
    expect(layout.order.slice(0, 2)).toEqual(["habits", "hero"]);
    expect(layout.order).toHaveLength(DEFAULT_LAYOUT.order.length);
    expect(layout.sizes.hero).toBe("sm");
    expect(layout.sizes.stats).toBe(DEFAULT_LAYOUT.sizes.stats);
  });

  it("moves widgets and cycles sizes", () => {
    expect(moveWidget(["hero", "stats", "habits"], "habits", "hero")).toEqual([
      "habits",
      "hero",
      "stats",
    ]);
    expect(nextSize("sm")).toBe("md");
    expect(nextSize("lg")).toBe("sm");
  });
});

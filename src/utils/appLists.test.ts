import { describe, expect, it } from "vitest";
import { parseAppList } from "./appLists";

describe("parseAppList", () => {
  it("splits on newlines, commas, and semicolons, trimming entries", () => {
    expect(parseAppList("Thaw\n Bartender ,Ice; Dozer")).toEqual([
      "Thaw",
      "Bartender",
      "Ice",
      "Dozer",
    ]);
  });

  it("drops empties and dedupes case-insensitively within the paste", () => {
    expect(parseAppList("thaw\n\nTHAW,  ,Thaw")).toEqual(["thaw"]);
  });

  it("dedupes against existing entries case-insensitively", () => {
    expect(parseAppList("Thaw\nWidget", ["thaw"])).toEqual(["Widget"]);
  });

  it("returns empty for blank input", () => {
    expect(parseAppList("  \n , ;")).toEqual([]);
  });
});

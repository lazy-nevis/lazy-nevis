import { describe, expect, it } from "vitest";
import { csvCell, csvRow } from "./csv";

describe("CSV escaping", () => {
  it("escapes commas, quotes, and newlines", () => {
    expect(csvCell('hello, "world"\nnext')).toBe('"hello, ""world""\nnext"');
  });

  it.each(["=1+1", "+cmd", "-2+3", "@SUM(A1)"])("neutralizes formula input %s", (value) => {
    expect(csvCell(value)).toBe(`"'${value}"`);
  });

  it("serializes primitive rows consistently", () => {
    expect(csvRow(["id", 12, false, null])).toBe('"id","12","false",""');
  });
});

import { describe, expect, it } from "vitest";
import { parseInlineTags } from "./checklistUtils";

// Spec scenario: daily-checklist/inline-tags
describe("parseInlineTags", () => {
  it("extracts tags and cleans the title", () => {
    expect(parseInlineTags("Review PR #work #urgent")).toEqual({
      title: "Review PR",
      tags: ["work", "urgent"],
    });
  });

  it("dedupes tags case-insensitively keeping the first casing", () => {
    expect(parseInlineTags("Task #Work #work")).toEqual({
      title: "Task",
      tags: ["Work"],
    });
  });

  it("handles tags in the middle and unicode", () => {
    expect(parseInlineTags("Ler #estudo artigo #ciência hoje")).toEqual({
      title: "Ler artigo hoje",
      tags: ["estudo", "ciência"],
    });
  });

  it("returns empty title when the input is only tags", () => {
    expect(parseInlineTags("#a #b")).toEqual({ title: "", tags: ["a", "b"] });
  });
});

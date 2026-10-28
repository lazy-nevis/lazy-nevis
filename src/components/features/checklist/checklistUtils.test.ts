import { describe, expect, it } from "vitest";
import { parseEntry, parseInlineTags } from "./checklistUtils";

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

describe("parseEntry", () => {
  const now = Date.parse("2026-10-26T10:00:00");

  it("parses category, priority, tag, and date", () => {
    const parsed = parseEntry("Enviar proposta @Infleux !alta até 03/11 #vendas", {
      now,
      locale: "pt-BR",
      dateRecognition: true,
    });
    expect(parsed.title).toBe("Enviar proposta");
    expect(parsed.category).toBe("Infleux");
    expect(parsed.priority).toBe("high");
    expect(parsed.tags).toEqual(["vendas"]);
    expect(parsed.due).not.toBeNull();
  });
});

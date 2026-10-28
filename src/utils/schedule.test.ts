import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { describeSchedule, emptyRule } from "@/utils/schedule";

describe("describeSchedule", () => {
  it("describes daily rules in English", async () => {
    await i18n.changeLanguage("en-US");
    const t = i18n.getFixedT("en-US");
    const text = describeSchedule(
      { kind: "daily", times: ["15:30"], weekdays: [1, 3] },
      t,
      "en-US",
      1,
    );
    expect(text).toContain("15:30");
    expect(text.toLowerCase()).toMatch(/mon|tue|wed|thu|fri|sat|sun/);
  });

  it("describes interval rules in Portuguese", async () => {
    await i18n.changeLanguage("pt-BR");
    const t = i18n.getFixedT("pt-BR");
    const text = describeSchedule(
      emptyRule("interval"),
      t,
      "pt-BR",
      1,
    );
    expect(text).toMatch(/60|hora/i);
  });

  it("formats once rules with the locale instead of the raw ISO value", async () => {
    await i18n.changeLanguage("en-US");
    const t = i18n.getFixedT("en-US");
    const text = describeSchedule({ kind: "once", at: "2026-10-27T11:00" }, t, "en-US", 1);
    expect(text).not.toContain("2026-10-27T11:00");
    expect(text).toContain("Oct 27, 2026");
  });
});

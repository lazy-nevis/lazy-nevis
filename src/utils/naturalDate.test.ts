import { describe, expect, it } from "vitest";
import { parseNaturalDate } from "./naturalDate";

// Monday 2026-10-26 10:00 local.
const NOW = Date.parse("2026-10-26T10:00:00");

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" (all-day) or "YYYY-MM-DD HH:mm"; null when nothing is recognized. */
function due(text: string, locale = "pt-BR", now = NOW): string | null {
  const match = parseNaturalDate(text, { now, locale });
  if (!match) return null;
  const d = new Date(match.dueMs);
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return match.hasTime ? `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
}

function matched(text: string, locale = "pt-BR", now = NOW): string | null {
  return parseNaturalDate(text, { now, locale })?.matchedText ?? null;
}

describe("parseNaturalDate — day/month bug (dia DD/MM)", () => {
  it("consumes the whole `dia 10/11` phrase, not just `dia 10`", () => {
    expect(matched("Fazer coisa X dia 10/11")).toBe("dia 10/11");
    expect(due("Fazer coisa X dia 10/11")).toBe("2026-11-10");
  });

  it("reads DD/MM/YYYY with a time, as in the Todoist reference", () => {
    const text = "Fazer coisa X dia 10/11/2027 as 18:30";
    expect(due(text)).toBe("2027-11-10 18:30");
    expect(matched(text)).toBe("dia 10/11/2027 as 18:30");
  });
});

describe("parseNaturalDate — numeric dates", () => {
  const cases: [string, string, string][] = [
    // text, locale, expected
    ["até 03/11", "pt-BR", "2026-11-03"],
    ["03/11", "pt-BR", "2026-11-03"],
    ["3/11", "pt-BR", "2026-11-03"],
    ["03/11/2026", "pt-BR", "2026-11-03"],
    ["03/11/26", "pt-BR", "2026-11-03"],
    ["3/1/2027", "pt-BR", "2027-01-03"],
    ["03-11-2026", "pt-BR", "2026-11-03"],
    ["03-11-26", "pt-BR", "2026-11-03"],
    ["03.11.2026", "pt-BR", "2026-11-03"],
    ["2026/11/03", "pt-BR", "2026-11-03"],
    ["2026-11-03", "pt-BR", "2026-11-03"],
    ["2026.11.03", "pt-BR", "2026-11-03"],
    ["2027-1-5", "pt-BR", "2027-01-05"],
    ["dia 03/11", "pt-BR", "2026-11-03"],
    ["no dia 03/11/2026", "pt-BR", "2026-11-03"],
    ["para o dia 03/11", "pt-BR", "2026-11-03"],
    ["dia 10-11", "pt-BR", "2026-11-10"],
    ["dia 10.11", "pt-BR", "2026-11-10"],
    ["dia 10.11.26", "pt-BR", "2026-11-10"],
    ["by 11/03", "en-US", "2026-11-03"],
    ["11/03/2026", "en-US", "2026-11-03"],
    ["11/03/26", "en-US", "2026-11-03"],
    ["until 12-25", "en-US", "2026-12-25"],
    ["due 25/12", "en-US", "2026-12-25"],
    ["on 2026-11-03", "en-US", "2026-11-03"],
    ["2026/11/03", "en-US", "2026-11-03"],
  ];
  for (const [text, locale, expected] of cases) {
    it(`${locale}: "${text}" -> ${expected}`, () => {
      expect(due(text, locale)).toBe(expected);
    });
  }

  it("assumes DD/MM in pt-BR even when both orders are valid", () => {
    expect(due("04/05")).toBe("2027-05-04"); // 4 May 2026 already passed
    expect(due("04/05/2026")).toBe("2026-05-04");
  });

  it("assumes MM/DD in en-US when both orders are valid and DD/MM when only that is valid", () => {
    expect(due("04/05/2027", "en-US")).toBe("2027-04-05");
    expect(due("25/12/2026", "en-US")).toBe("2026-12-25");
  });

  it("does not swap pt-BR into MM/DD", () => {
    expect(due("12/25", "pt-BR")).toBeNull();
  });

  it("keeps the full span (no leftover `/11`) for every separator", () => {
    expect(matched("dia 10/11")).toBe("dia 10/11");
    expect(matched("dia 10-11")).toBe("dia 10-11");
    expect(matched("até 10.11.2026")).toBe("até 10.11.2026");
    expect(matched("entregar 2026-11-03 sem falta")).toBe("2026-11-03");
  });
});

describe("parseNaturalDate — year handling", () => {
  it("rolls a past day/month to next year", () => {
    expect(due("05/10")).toBe("2027-10-05");
    expect(due("3 de outubro")).toBe("2027-10-03");
  });

  it("keeps today and future dates in the current year", () => {
    expect(due("26/10")).toBe("2026-10-26");
    expect(due("27/10")).toBe("2026-10-27");
    expect(due("31/12")).toBe("2026-12-31");
  });

  it("rolls when 'now' is late December", () => {
    const dec = Date.parse("2026-12-30T09:00:00");
    expect(due("02/01", "pt-BR", dec)).toBe("2027-01-02");
    expect(due("30/12", "pt-BR", dec)).toBe("2026-12-30");
    expect(due("29/12", "pt-BR", dec)).toBe("2027-12-29");
  });

  it("keeps an explicit past year as typed", () => {
    expect(due("01/10/2025")).toBe("2025-10-01");
  });

  it("expands 2-digit years to 20YY", () => {
    expect(due("03/11/27")).toBe("2027-11-03");
    expect(due("03/11/99")).toBe("2099-11-03");
  });

  it("finds 29/02 in the next leap year", () => {
    expect(due("29/02")).toBe("2028-02-29");
    expect(due("29/02/2028")).toBe("2028-02-29");
    expect(due("29/02/2027")).toBeNull();
  });
});

describe("parseNaturalDate — day only", () => {
  it("dia N is this month when still ahead", () => {
    expect(due("dia 28")).toBe("2026-10-28");
    expect(due("dia 26")).toBe("2026-10-26");
  });

  it("dia N moves to the next month when it passed", () => {
    expect(due("dia 5")).toBe("2026-11-05");
  });

  it("skips months without that day", () => {
    const apr = Date.parse("2026-04-20T10:00:00");
    expect(due("dia 31", "pt-BR", apr)).toBe("2026-05-31");
  });

  it("rejects impossible days", () => {
    expect(due("dia 32")).toBeNull();
    expect(due("dia 0")).toBeNull();
  });

  it("recognizes English ordinals", () => {
    expect(due("on the 30th", "en-US")).toBe("2026-10-30");
    expect(due("by 3rd", "en-US")).toBe("2026-11-03");
  });

  it("never reads bare numbers as dates", () => {
    expect(due("Comprar 5 itens")).toBeNull();
    expect(due("Revisar 12 páginas")).toBeNull();
    expect(due("task 15", "en-US")).toBeNull();
    expect(due("v1.2")).toBeNull();
    expect(due("passos 1-2")).toBeNull();
    expect(due("versão 1.2.3")).toBeNull();
  });
});

describe("parseNaturalDate — invalid dates", () => {
  const invalid: [string, string][] = [
    ["31/02/2026", "pt-BR"],
    ["31/02", "pt-BR"],
    ["30/02", "pt-BR"],
    ["31/04", "pt-BR"],
    ["13/13", "pt-BR"],
    ["00/10", "pt-BR"],
    ["10/00", "pt-BR"],
    ["32/01/2026", "pt-BR"],
    ["task 99/99", "pt-BR"],
    ["2026-13-01", "pt-BR"],
    ["2026-02-30", "pt-BR"],
    ["13/13/2026", "en-US"],
    ["02/30/2026", "en-US"],
  ];
  for (const [text, locale] of invalid) {
    it(`${locale}: "${text}" is not a date`, () => {
      expect(due(text, locale)).toBeNull();
    });
  }
});

describe("parseNaturalDate — time", () => {
  const cases: [string, string, string][] = [
    ["Reunião 18:30", "pt-BR", "2026-10-26 18:30"],
    ["Reunião 18h30", "pt-BR", "2026-10-26 18:30"],
    ["Reunião às 18h", "pt-BR", "2026-10-26 18:00"],
    ["Reunião as 18h", "pt-BR", "2026-10-26 18:00"],
    ["Reunião às 18", "pt-BR", "2026-10-26 18:00"],
    ["Reunião às 18:30", "pt-BR", "2026-10-26 18:30"],
    ["Meeting at 6pm", "en-US", "2026-10-26 18:00"],
    ["Meeting 6pm", "en-US", "2026-10-26 18:00"],
    ["Meeting 6 pm", "en-US", "2026-10-26 18:00"],
    ["Meeting at 6:30 pm", "en-US", "2026-10-26 18:30"],
    ["Meeting at 6:30PM", "en-US", "2026-10-26 18:30"],
    ["Meeting at 18:30", "en-US", "2026-10-26 18:30"],
    ["Meeting at 18", "en-US", "2026-10-26 18:00"],
    ["Meeting 12am tomorrow", "en-US", "2026-10-27 00:00"],
    ["Meeting 12pm tomorrow", "en-US", "2026-10-27 12:00"],
    ["almoço meio-dia amanhã", "pt-BR", "2026-10-27 12:00"],
    ["lunch at noon tomorrow", "en-US", "2026-10-27 12:00"],
    ["deploy midnight friday", "en-US", "2026-10-30 00:00"],
    ["Reunião 23:59 hoje", "pt-BR", "2026-10-26 23:59"],
  ];
  for (const [text, locale, expected] of cases) {
    it(`${locale}: "${text}" -> ${expected}`, () => {
      expect(due(text, locale)).toBe(expected);
    });
  }

  it("a bare time already past today means tomorrow", () => {
    expect(due("Reunião 08:30")).toBe("2026-10-27 08:30");
    expect(due("Reunião 10:00")).toBe("2026-10-26 10:00");
  });

  it("an explicit 'hoje' keeps a past time on today", () => {
    expect(due("Reunião 08:30 hoje")).toBe("2026-10-26 08:30");
  });

  it("combines time with date forms", () => {
    expect(due("amanhã às 15h")).toBe("2026-10-27 15:00");
    expect(due("meeting at 3pm tomorrow", "en-US")).toBe("2026-10-27 15:00");
    expect(due("15h30 hoje")).toBe("2026-10-26 15:30");
    expect(due("15:30 today", "en-US")).toBe("2026-10-26 15:30");
    expect(due("03/11 18h")).toBe("2026-11-03 18:00");
    expect(due("03/11 às 18:30")).toBe("2026-11-03 18:30");
    expect(due("2026-11-03 18:30")).toBe("2026-11-03 18:30");
    expect(due("terça às 9h")).toBe("2026-10-27 09:00");
    expect(due("na sexta 14:00")).toBe("2026-10-30 14:00");
    expect(due("dia 28 às 7pm", "pt-BR")).toBe("2026-10-28 19:00");
  });

  it("merges an adjacent date and time into one span", () => {
    const match = parseNaturalDate("Ligar amanhã às 15h30 para João", { now: NOW, locale: "pt-BR" });
    expect(match?.spans).toHaveLength(1);
    expect(match?.matchedText).toBe("amanhã às 15h30");
  });

  it("keeps separate spans for a non-adjacent date and time", () => {
    const match = parseNaturalDate("amanhã comprar pão às 15h", { now: NOW, locale: "pt-BR" });
    expect(match?.spans).toHaveLength(2);
    expect(match?.hasTime).toBe(true);
  });

  it("does not take a duration for a time", () => {
    expect(due("Estudar 2h")).toBeNull();
    expect(due("Estudar 2h hoje")).toBe("2026-10-26");
    expect(due("Estudar 2h amanhã")).toBe("2026-10-27");
    expect(due("amanhã 2h")).toBe("2026-10-27 02:00");
  });

  it("rejects invalid times", () => {
    expect(due("Reunião 25:00")).toBeNull();
    expect(due("Reunião 18:75")).toBeNull();
    expect(due("Reunião 13pm", "en-US")).toBeNull();
    expect(due("Reunião às 25")).toBeNull();
    expect(due("Reunião 0pm", "en-US")).toBeNull();
  });

  it("an invalid time does not discard a valid date", () => {
    expect(due("amanhã 25:00")).toBe("2026-10-27");
  });

  it("does not read a date as a time", () => {
    expect(due("03/11 2026")).toBe("2026-11-03");
    expect(due("10.30.2026", "en-US")).toBe("2026-10-30");
  });
});

describe("parseNaturalDate — relative words", () => {
  const cases: [string, string, string][] = [
    ["hoje", "pt-BR", "2026-10-26"],
    ["amanhã", "pt-BR", "2026-10-27"],
    ["amanha", "pt-BR", "2026-10-27"],
    ["pra amanhã", "pt-BR", "2026-10-27"],
    ["depois de amanhã", "pt-BR", "2026-10-28"],
    ["today", "en-US", "2026-10-26"],
    ["tomorrow", "en-US", "2026-10-27"],
    ["day after tomorrow", "en-US", "2026-10-28"],
    ["em 2 dias", "pt-BR", "2026-10-28"],
    ["daqui a 1 semana", "pt-BR", "2026-11-02"],
    ["em 1 mês", "pt-BR", "2026-11-26"],
    ["in 3 weeks", "en-US", "2026-11-16"],
    ["in 2 months", "en-US", "2026-12-26"],
    ["na segunda", "pt-BR", "2026-11-02"],
    ["próxima sexta", "pt-BR", "2026-10-30"],
    ["proxima terca", "pt-BR", "2026-10-27"],
    ["neste sábado", "pt-BR", "2026-10-31"],
    ["domingo", "pt-BR", "2026-11-01"],
    ["terça-feira", "pt-BR", "2026-10-27"],
    ["next monday", "en-US", "2026-11-02"],
    ["this friday", "en-US", "2026-10-30"],
    ["saturday", "en-US", "2026-10-31"],
    ["on sunday", "en-US", "2026-11-01"],
    ["3 de novembro", "pt-BR", "2026-11-03"],
    ["3 de nov", "pt-BR", "2026-11-03"],
    ["3 nov", "pt-BR", "2026-11-03"],
    ["3 de novembro de 2027", "pt-BR", "2027-11-03"],
    ["3 nov 2027", "pt-BR", "2027-11-03"],
    ["november 3", "en-US", "2026-11-03"],
    ["nov 3rd", "en-US", "2026-11-03"],
    ["Nov 3, 2027", "en-US", "2027-11-03"],
    ["december 25 2026", "en-US", "2026-12-25"],
  ];
  for (const [text, locale, expected] of cases) {
    it(`${locale}: "${text}" -> ${expected}`, () => {
      expect(due(text, locale)).toBe(expected);
    });
  }

  it("ignores words that merely look like a weekday or month", () => {
    expect(due("Revisar segunda versão")).toBeNull();
    expect(due("plain task", "en-US")).toBeNull();
    expect(due("Ler 3 mar de coisas")).toBeNull();
    expect(due("Comprar 2 set de facas")).toBeNull();
  });

  it("ambiguous pt abbreviations count with `de` or a year", () => {
    expect(due("3 de mar")).toBe("2027-03-03");
    expect(due("3 mar 2027")).toBe("2027-03-03");
  });

  it("keeps the last date when several are typed", () => {
    expect(matched("até 03/11 e depois 05/11")).toContain("05/11");
    expect(due("até 03/11 e depois 05/11")).toBe("2026-11-05");
  });

  it("ignores text without any date", () => {
    expect(due("")).toBeNull();
    expect(due("   ")).toBeNull();
    expect(due("Enviar proposta @Infleux !alta #vendas")).toBeNull();
  });
});

describe("parseNaturalDate — spans", () => {
  it("reports exact offsets so the title can be cleaned", () => {
    const text = "Pagar boleto dia 10/11 às 9h e ligar";
    const match = parseNaturalDate(text, { now: NOW, locale: "pt-BR" });
    expect(match).not.toBeNull();
    expect(text.slice(match!.start, match!.end)).toBe("dia 10/11 às 9h");
    expect(match!.spans).toEqual([{ start: match!.start, end: match!.end }]);
  });
});

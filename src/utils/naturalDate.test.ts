import { describe, expect, it } from "vitest";
import { parseNaturalDate } from "./naturalDate";

const NOW = Date.parse("2026-10-26T10:00:00");

describe("parseNaturalDate", () => {
  const cases: { text: string; locale: string; expectDue?: boolean; contains?: string }[] = [
    { text: "hoje", locale: "pt-BR", expectDue: true },
    { text: "amanhã", locale: "pt-BR", expectDue: true },
    { text: "depois de amanhã", locale: "pt-BR", expectDue: true },
    { text: "today", locale: "en-US", expectDue: true },
    { text: "tomorrow", locale: "en-US", expectDue: true },
    { text: "day after tomorrow", locale: "en-US", expectDue: true },
    { text: "em 2 dias", locale: "pt-BR", expectDue: true },
    { text: "in 3 weeks", locale: "en-US", expectDue: true },
    { text: "na segunda", locale: "pt-BR", expectDue: true },
    { text: "next monday", locale: "en-US", expectDue: true },
    { text: "até 03/11", locale: "pt-BR", expectDue: true, contains: "03/11" },
    { text: "by 11/03", locale: "en-US", expectDue: true },
    { text: "2026-11-03", locale: "en-US", expectDue: true },
    { text: "3 de novembro", locale: "pt-BR", expectDue: true },
    { text: "november 3", locale: "en-US", expectDue: true },
    { text: "Reunião amanhã às 15h", locale: "pt-BR", expectDue: true },
    { text: "meeting at 3pm tomorrow", locale: "en-US", expectDue: true },
    { text: "Revisar segunda versão", locale: "pt-BR", expectDue: false },
    { text: "31/02/2026", locale: "pt-BR", expectDue: false },
    { text: "plain task", locale: "en-US", expectDue: false },
    { text: "até 01/10/2026", locale: "pt-BR", expectDue: true },
    { text: "dia 5", locale: "pt-BR", expectDue: true },
    { text: "daqui a 1 semana", locale: "pt-BR", expectDue: true },
    { text: "domingo", locale: "pt-BR", expectDue: true },
    { text: "saturday", locale: "en-US", expectDue: true },
    { text: "terça-feira", locale: "pt-BR", expectDue: true },
    { text: "próxima sexta", locale: "pt-BR", expectDue: true },
    { text: "this friday", locale: "en-US", expectDue: true },
    { text: "until 12-25", locale: "en-US", expectDue: true },
    { text: "due 25/12", locale: "pt-BR", expectDue: true },
    { text: "15h30 hoje", locale: "pt-BR", expectDue: true },
    { text: "15:30 today", locale: "en-US", expectDue: true },
    { text: "em 1 mês", locale: "pt-BR", expectDue: true },
    { text: "in 2 months", locale: "en-US", expectDue: true },
    { text: "Ler capítulo 3 de novembro", locale: "pt-BR", expectDue: true },
    { text: "task 99/99", locale: "pt-BR", expectDue: false },
    { text: "até 03/11 e depois 05/11", locale: "pt-BR", expectDue: true, contains: "05/11" },
    { text: "amanha", locale: "pt-BR", expectDue: true },
    { text: "proxima terca", locale: "pt-BR", expectDue: true },
    { text: "neste sábado", locale: "pt-BR", expectDue: true },
    { text: "on sunday", locale: "en-US", expectDue: true },
    { text: "3 de nov", locale: "pt-BR", expectDue: true },
    { text: "nov 3rd", locale: "en-US", expectDue: true },
    { text: "até dia 03/11", locale: "pt-BR", expectDue: true },
    { text: "pra amanhã", locale: "pt-BR", expectDue: true },
  ];

  for (const [index, caseDef] of cases.entries()) {
    it(`case ${index + 1}: ${caseDef.text}`, () => {
      const match = parseNaturalDate(caseDef.text, { now: NOW, locale: caseDef.locale });
      if (caseDef.expectDue) {
        expect(match).not.toBeNull();
        if (caseDef.contains) {
          expect(match?.matchedText).toContain(caseDef.contains);
        }
      } else {
        expect(match).toBeNull();
      }
    });
  }
});

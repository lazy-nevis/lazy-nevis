import { startOfLocalDay } from "@/utils/dates";

export interface NaturalDateMatch {
  start: number;
  end: number;
  dueMs: number;
  hasTime: boolean;
  matchedText: string;
}

export interface ParseNaturalDateOptions {
  now: number;
  locale: string;
}

const PT_MONTHS: Record<string, number> = {
  janeiro: 1,
  jan: 1,
  fevereiro: 2,
  fev: 2,
  marco: 3,
  março: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  maio: 5,
  mai: 5,
  junho: 6,
  jun: 6,
  julho: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  setembro: 9,
  set: 9,
  outubro: 10,
  out: 10,
  novembro: 11,
  nov: 11,
  dezembro: 12,
  dez: 12,
};

const EN_MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const PT_WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  "segunda-feira": 1,
  terca: 2,
  terça: 2,
  "terça-feira": 2,
  "terca-feira": 2,
  quarta: 3,
  "quarta-feira": 3,
  quinta: 4,
  "quinta-feira": 4,
  sexta: 5,
  "sexta-feira": 5,
  sabado: 6,
  sábado: 6,
};

const EN_WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

function isPt(locale: string): boolean {
  return locale.toLowerCase().startsWith("pt");
}

function nextWeekdayAfter(from: Date, targetDow: number): Date {
  const base = new Date(from);
  base.setHours(0, 0, 0, 0);
  const current = base.getDay();
  let delta = (targetDow - current + 7) % 7;
  if (delta === 0) delta = 7;
  base.setDate(base.getDate() + delta);
  return base;
}

function rollForwardYear(month: number, day: number, now: Date, year?: number): Date | null {
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const candidate = year !== undefined
    ? new Date(year, month - 1, day)
    : new Date(now.getFullYear(), month - 1, day);
  if (candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;
  if (year === undefined) {
    candidate.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    if (candidate < today) {
      candidate.setFullYear(candidate.getFullYear() + 1);
    }
  }
  return candidate;
}

function parseTimeSuffix(text: string): { hasTime: boolean; due: Date } | null {
  const lower = stripDiacritics(text.toLowerCase());
  const atMatch = lower.match(
    /(?:\s|^)(?:às|as|at)\s+(\d{1,2})(?::(\d{2}))?\s*(h|am|pm)?/i,
  );
  const hMatch = lower.match(/(?:\s|^)(\d{1,2})h(\d{2})?\b/);
  const colonMatch = lower.match(/(?:\s|^)(\d{1,2}):(\d{2})\s*(h|am|pm)?/i);
  const match = atMatch ?? hMatch ?? colonMatch;
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  const due = new Date();
  due.setHours(hour, minute, 0, 0);
  return { hasTime: true, due };
}

interface Candidate {
  start: number;
  end: number;
  dueMs: number;
  hasTime: boolean;
}

function addCandidate(candidates: Candidate[], start: number, end: number, due: Date, hasTime: boolean) {
  candidates.push({ start, end, dueMs: due.getTime(), hasTime });
}

export function parseNaturalDate(text: string, options: ParseNaturalDateOptions): NaturalDateMatch | null {
  const { now, locale } = options;
  const nowDate = new Date(now);
  const candidates: Candidate[] = [];
  const lead = String.raw`(?:\b(?:até|ate|para|pra|no dia|by|on|due|until)\s*(?:o\s+)?(?:dia\s+)?)?`;

  const relativePt = [
    { re: /\bhoje\b/gi, add: () => startOfLocalDay(now) },
    { re: /(?:^|\s)(?:pra\s+)?amanh(a|ã)(?=\s|$|[,.])/gi, add: () => startOfLocalDay(now) + 86400000 },
    { re: /(?:^|\s)depois de amanh(a|ã)(?=\s|$|[,.])/gi, add: () => startOfLocalDay(now) + 2 * 86400000 },
  ];
  const relativeEn = [
    { re: /\btoday\b/gi, add: () => startOfLocalDay(now) },
    { re: /\btomorrow\b/gi, add: () => startOfLocalDay(now) + 86400000 },
    { re: /\bday after tomorrow\b/gi, add: () => startOfLocalDay(now) + 2 * 86400000 },
  ];

  for (const entry of [...relativePt, ...relativeEn]) {
    for (const match of text.matchAll(entry.re)) {
      const due = new Date(entry.add());
      const start = match.index ?? 0;
      const leading = match[0].startsWith(" ") ? 1 : 0;
      addCandidate(candidates, start + leading, start + match[0].length, due, false);
    }
  }

  const offsetRe =
    /\b(?:em|daqui a|in)\s+(\d+)\s+(dia|dias|day|days|semana|semanas|week|weeks|m[eê]s|meses|month|months)\b/gi;
  for (const match of text.matchAll(offsetRe)) {
    const n = Number(match[1]);
    const unit = stripDiacritics(match[2].toLowerCase());
    const due = new Date(nowDate);
    due.setHours(0, 0, 0, 0);
    if (unit.startsWith("dia") || unit.startsWith("day")) due.setDate(due.getDate() + n);
    else if (unit.startsWith("seman") || unit.startsWith("week")) due.setDate(due.getDate() + n * 7);
    else due.setMonth(due.getMonth() + n);
    addCandidate(candidates, match.index ?? 0, (match.index ?? 0) + match[0].length, due, false);
  }

  const weekdayPrefix =
    String.raw`\b(?:na|no|nesta|neste|proxima|proximo|próxima|próximo|esta|este|this|next|on)\s+`;
  for (const match of text.matchAll(new RegExp(`${weekdayPrefix}([a-zà-ú-]+)`, "gi"))) {
    const word = stripDiacritics(match[1].toLowerCase());
    const dow = PT_WEEKDAYS[word] ?? EN_WEEKDAYS[word];
    if (dow === undefined) continue;
    const due = nextWeekdayAfter(nowDate, dow);
    addCandidate(candidates, match.index ?? 0, (match.index ?? 0) + match[0].length, due, false);
  }

  for (const match of text.matchAll(/\b(segunda-feira|terça-feira|terca-feira|quarta-feira|quinta-feira|sexta-feira)\b/gi)) {
    const word = stripDiacritics(match[0].toLowerCase());
    const dow = PT_WEEKDAYS[word];
    if (dow === undefined) continue;
    const due = nextWeekdayAfter(nowDate, dow);
    addCandidate(candidates, match.index ?? 0, (match.index ?? 0) + match[0].length, due, false);
  }

  for (const match of text.matchAll(/\b(sabado|sábado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi)) {
    const word = stripDiacritics(match[0].toLowerCase());
    const dow = PT_WEEKDAYS[word] ?? EN_WEEKDAYS[word];
    if (dow === undefined) continue;
    const due = nextWeekdayAfter(nowDate, dow);
    addCandidate(candidates, match.index ?? 0, (match.index ?? 0) + match[0].length, due, false);
  }

  const isoRe = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  for (const match of text.matchAll(isoRe)) {
    const due = rollForwardYear(Number(match[2]), Number(match[3]), nowDate, Number(match[1]));
    if (!due) continue;
    addCandidate(candidates, match.index ?? 0, (match.index ?? 0) + match[0].length, due, false);
  }

  const slashRe = isPt(locale)
    ? /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/g
    : /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/g;
  for (const match of text.matchAll(slashRe)) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    const yearPart = match[3];
    let year: number | undefined;
    if (yearPart) {
      const y = Number(yearPart);
      year = yearPart.length === 2 ? 2000 + y : y;
    }
    const day = isPt(locale) ? a : b;
    const month = isPt(locale) ? b : a;
    const due = rollForwardYear(month, day, nowDate, year);
    if (!due) continue;
    addCandidate(candidates, match.index ?? 0, (match.index ?? 0) + match[0].length, due, false);
  }

  for (const match of text.matchAll(/\bdia\s+(\d{1,2})\b/gi)) {
    const day = Number(match[1]);
    const due = rollForwardYear(nowDate.getMonth() + 1, day, nowDate);
    if (!due) continue;
    addCandidate(candidates, match.index ?? 0, (match.index ?? 0) + match[0].length, due, false);
  }

  const monthNameRe =
    /\b(\d{1,2})\s+de\s+([a-zà-ú]+)(?:\s+de\s+(\d{4}))?\b/gi;
  for (const match of text.matchAll(monthNameRe)) {
    const day = Number(match[1]);
    const monthKey = stripDiacritics(match[2].toLowerCase());
    const month = PT_MONTHS[monthKey] ?? EN_MONTHS[monthKey];
    if (!month) continue;
    const year = match[3] ? Number(match[3]) : undefined;
    const due = rollForwardYear(month, day, nowDate, year);
    if (!due) continue;
    addCandidate(candidates, match.index ?? 0, (match.index ?? 0) + match[0].length, due, false);
  }

  const enMonthRe =
    /\b([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?\b/gi;
  for (const match of text.matchAll(enMonthRe)) {
    const monthKey = stripDiacritics(match[1].toLowerCase());
    const month = EN_MONTHS[monthKey];
    if (!month) continue;
    const day = Number(match[2]);
    const year = match[3] ? Number(match[3]) : undefined;
    const due = rollForwardYear(month, day, nowDate, year);
    if (!due) continue;
    addCandidate(candidates, match.index ?? 0, (match.index ?? 0) + match[0].length, due, false);
  }

  const leadSlash = new RegExp(`${lead}(\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?)`, "gi");
  for (const match of text.matchAll(leadSlash)) {
    const inner = match[1];
    const innerMatch = inner.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
    if (!innerMatch) continue;
    const a = Number(innerMatch[1]);
    const b = Number(innerMatch[2]);
    const yearPart = innerMatch[3];
    let year: number | undefined;
    if (yearPart) {
      const y = Number(yearPart);
      year = yearPart.length === 2 ? 2000 + y : y;
    }
    const day = isPt(locale) ? a : b;
    const month = isPt(locale) ? b : a;
    const due = rollForwardYear(month, day, nowDate, year);
    if (!due) continue;
    addCandidate(candidates, match.index ?? 0, (match.index ?? 0) + match[0].length, due, false);
  }

  if (candidates.length === 0) return null;

  const last = candidates[candidates.length - 1];
  const timePart = parseTimeSuffix(text.slice(last.end));
  let dueMs = last.dueMs;
  let hasTime = last.hasTime;
  let end = last.end;
  if (timePart) {
    const due = new Date(last.dueMs);
    due.setHours(timePart.due.getHours(), timePart.due.getMinutes(), 0, 0);
    dueMs = due.getTime();
    hasTime = true;
    const timeMatch = text.slice(last.end).match(/(?:às|as|at)?\s*\d{1,2}(?::\d{2})?\s*(?:h\d{0,2}|am|pm)?/i);
    if (timeMatch) end = last.end + timeMatch.index! + timeMatch[0].length;
  }

  return {
    start: last.start,
    end,
    dueMs,
    hasTime,
    matchedText: text.slice(last.start, end).trim(),
  };
}

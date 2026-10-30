import { startOfLocalDay } from "@/utils/dates";

export interface NaturalDateSpan {
  start: number;
  end: number;
}

export interface NaturalDateMatch {
  /** Outer bounds of everything recognized (date and time). */
  start: number;
  end: number;
  /** Disjoint recognized spans (a date and a non-adjacent time are separate). */
  spans: NaturalDateSpan[];
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

/** Abbreviations that are also everyday words; they need "de" or a year to count as a month. */
const AMBIGUOUS_PT_ABBR = new Set(["mar", "set", "out", "mai", "dez"]);

const PT_WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  "segunda-feira": 1,
  terca: 2,
  "terca-feira": 2,
  quarta: 3,
  "quarta-feira": 3,
  quinta: 4,
  "quinta-feira": 4,
  sexta: 5,
  "sexta-feira": 5,
  sabado: 6,
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

const DAY_MS = 86_400_000;
const MIN_YEAR = 1970;
const MAX_YEAR = 2199;

// Unicode-aware word boundaries (`\b` is ASCII-only, so it breaks on "amanhã", "às").
const NB = String.raw`(?<![\p{L}\p{N}])`;
const NA = String.raw`(?![\p{L}\p{N}])`;
/** Not glued to a digit or a date separator (avoids reading pieces of longer numbers). */
const NUM_BEFORE = String.raw`(?<![\p{L}\p{N}/-]|\d\.)`;
const NUM_AFTER = String.raw`(?!\d|[/-]\d|\.\d)`;

const LEAD_WORDS = String.raw`(?:até|ate|para|pra|no dia|by|on|due|until)`;
const LEAD = String.raw`(?:${NB}${LEAD_WORDS}\s+)?(?:${NB}o\s+)?(?:${NB}dia\s+)?`;

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

function isPt(locale: string): boolean {
  return locale.toLowerCase().startsWith("pt");
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Valid calendar date at local midnight, or null (no JS Date overflow: 31/02 is rejected). */
function makeDate(year: number, month: number, day: number): Date | null {
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return new Date(year, month - 1, day);
}

function expandYear(raw: string): number {
  const year = Number(raw);
  return raw.length <= 2 ? 2000 + year : year;
}

/** Month/day without a year: this year, or next year when it already passed. */
function rollForward(month: number, day: number, today: Date): Date | null {
  const thisYear = makeDate(today.getFullYear(), month, day);
  if (thisYear && thisYear >= today) return thisYear;
  // 29/02 can need several years ahead.
  for (let year = today.getFullYear() + 1; year <= today.getFullYear() + 8; year++) {
    const candidate = makeDate(year, month, day);
    if (candidate) return candidate;
  }
  return null;
}

/** Day of month without month: next occurrence of that day (this month if still ahead). */
function nextDayOfMonth(day: number, today: Date): Date | null {
  for (let offset = 0; offset < 14; offset++) {
    const probe = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const candidate = makeDate(probe.getFullYear(), probe.getMonth() + 1, day);
    if (candidate && candidate >= today) return candidate;
  }
  return null;
}

function nextWeekdayAfter(from: Date, targetDow: number): Date {
  const base = new Date(from);
  base.setHours(0, 0, 0, 0);
  let delta = (targetDow - base.getDay() + 7) % 7;
  if (delta === 0) delta = 7;
  base.setDate(base.getDate() + delta);
  return base;
}

interface DateCandidate extends NaturalDateSpan {
  date: Date;
}

interface TimeCandidate extends NaturalDateSpan {
  hour: number;
  minute: number;
  /** Bare "18h" with no lead word: only valid next to a date. */
  needsDate: boolean;
}

function pushDate(list: DateCandidate[], match: RegExpMatchArray, date: Date | null, skipLeading = 0) {
  if (!date || match.index === undefined) return;
  const start = match.index + skipLeading;
  list.push({ start, end: match.index + match[0].length, date });
}

/** Order the two numbers of a `A/B` date as [day, month] for the locale. */
function orderDayMonth(a: number, b: number, pt: boolean): [number, number] {
  if (pt) return [a, b];
  // en-US reads M/D, but 25/12 can only mean D/M.
  return a > 12 && b <= 12 ? [a, b] : [b, a];
}

function collectDates(text: string, today: Date, pt: boolean, now: number): DateCandidate[] {
  const out: DateCandidate[] = [];
  const todayMs = startOfLocalDay(now);

  // Relative words.
  const relative: { re: RegExp; offset: number }[] = [
    { re: new RegExp(`${NB}(?:hoje|today)${NA}`, "giu"), offset: 0 },
    { re: new RegExp(`${NB}(?:pra\\s+)?amanh[aã]${NA}`, "giu"), offset: 1 },
    { re: new RegExp(`${NB}tomorrow${NA}`, "giu"), offset: 1 },
    { re: new RegExp(`${NB}(?:depois de amanh[aã]|day after tomorrow)${NA}`, "giu"), offset: 2 },
  ];
  for (const { re, offset } of relative) {
    for (const match of text.matchAll(re)) {
      pushDate(out, match, new Date(todayMs + offset * DAY_MS));
    }
  }

  // Offsets: "em 2 dias", "in 3 weeks".
  const offsetRe = new RegExp(
    `${NB}(?:em|daqui a|in)\\s+(\\d+)\\s+(dias?|days?|semanas?|weeks?|m[eê]s|meses|months?)${NA}`,
    "giu",
  );
  for (const match of text.matchAll(offsetRe)) {
    const n = Number(match[1]);
    const unit = stripDiacritics(match[2].toLowerCase());
    const due = new Date(today);
    if (unit.startsWith("dia") || unit.startsWith("day")) due.setDate(due.getDate() + n);
    else if (unit.startsWith("seman") || unit.startsWith("week")) due.setDate(due.getDate() + n * 7);
    else due.setMonth(due.getMonth() + n);
    pushDate(out, match, due);
  }

  // Weekdays: bare names that are not also common words, or any name behind a prefix.
  const weekdayWords = [...Object.keys(PT_WEEKDAYS), ...Object.keys(EN_WEEKDAYS)]
    .sort((a, b) => b.length - a.length)
    .map((word) => word.replace(/[-]/g, "[- ]?"));
  const weekdayAlt = `(?:${weekdayWords.join("|")}|ter[cç]a(?:-feira)?|s[aá]bado)`;
  const prefix = String.raw`(?:na|no|nesta|neste|pr[oó]xima|pr[oó]ximo|esta|este|this|next|on)\s+`;
  const bareWeekdays = new Set(["domingo", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);
  const weekdayRe = new RegExp(`(?:${NB}${prefix})?${NB}(${weekdayAlt})${NA}`, "giu");
  for (const match of text.matchAll(weekdayRe)) {
    const word = stripDiacritics(match[1].toLowerCase());
    const dow = PT_WEEKDAYS[word] ?? EN_WEEKDAYS[word];
    if (dow === undefined) continue;
    const hasPrefix = match[0].length > match[1].length;
    const bare = bareWeekdays.has(word) || word === "sabado" || word.endsWith("-feira");
    if (!hasPrefix && !bare) continue; // "segunda versão" is not a date
    pushDate(out, match, nextWeekdayAfter(today, dow));
  }

  // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD (year first is unambiguous).
  const ymdRe = new RegExp(`(${LEAD})${NUM_BEFORE}(\\d{4})([-/.])(\\d{1,2})\\3(\\d{1,2})${NUM_AFTER}`, "giu");
  for (const match of text.matchAll(ymdRe)) {
    pushDate(out, match, makeDate(Number(match[2]), Number(match[4]), Number(match[5])));
  }

  // D/M/Y: separators / - . ; 2-digit year only with / or - ; "." needs a 4-digit year.
  const dmyRe = new RegExp(`(${LEAD})${NUM_BEFORE}(\\d{1,2})([-/.])(\\d{1,2})\\3(\\d{4}|\\d{2})${NUM_AFTER}`, "giu");
  for (const match of text.matchAll(dmyRe)) {
    const sep = match[3];
    const yearRaw = match[5];
    if (sep === "." && yearRaw.length === 2 && match[1].trim() === "") continue;
    const [day, month] = orderDayMonth(Number(match[2]), Number(match[4]), pt);
    pushDate(out, match, makeDate(expandYear(yearRaw), month, day));
  }

  // D/M, with "-" or "." only behind a lead word ("dia 10-11", "until 12-25").
  const dmRe = new RegExp(`(${LEAD})${NUM_BEFORE}(\\d{1,2})([-/.])(\\d{1,2})${NUM_AFTER}`, "giu");
  for (const match of text.matchAll(dmRe)) {
    if (match[3] !== "/" && match[1].trim() === "") continue;
    const [day, month] = orderDayMonth(Number(match[2]), Number(match[4]), pt);
    pushDate(out, match, rollForward(month, day, today));
  }

  // Day only: "dia 5", "no dia 15", "the 5th", "on 3rd".
  const dayOnlyRe = new RegExp(
    `(?:${NB}${LEAD_WORDS}\\s+)?(?:${NB}o\\s+)?${NB}dia\\s+(\\d{1,2})${NUM_AFTER}${NA}`,
    "giu",
  );
  for (const match of text.matchAll(dayOnlyRe)) {
    pushDate(out, match, nextDayOfMonth(Number(match[1]), today));
  }
  const ordinalRe = new RegExp(`(?:${NB}(?:on|by|until|due)\\s+)?(?:${NB}the\\s+)?${NB}(\\d{1,2})(?:st|nd|rd|th)${NA}`, "giu");
  for (const match of text.matchAll(ordinalRe)) {
    pushDate(out, match, nextDayOfMonth(Number(match[1]), today));
  }

  // "3 de novembro [de 2027]", "3 nov 2027".
  const dayMonthRe = new RegExp(
    `(${LEAD})${NB}(\\d{1,2})(\\s+de\\s+|\\s+)(\\p{L}+)(?:(?:\\s+de\\s+|\\s+)(\\d{4}))?${NA}`,
    "giu",
  );
  for (const match of text.matchAll(dayMonthRe)) {
    const key = stripDiacritics(match[4].toLowerCase());
    const month = PT_MONTHS[key] ?? EN_MONTHS[key];
    if (!month) continue;
    const hasDe = match[3].includes("de");
    const year = match[5] ? Number(match[5]) : undefined;
    if (AMBIGUOUS_PT_ABBR.has(key) && !hasDe && year === undefined) continue;
    const day = Number(match[2]);
    pushDate(out, match, year !== undefined ? makeDate(year, month, day) : rollForward(month, day, today));
  }

  // "november 3", "nov 3rd, 2027".
  const monthDayRe = new RegExp(
    `(${LEAD})${NB}(\\p{L}+)\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?${NUM_AFTER}${NA}`,
    "giu",
  );
  for (const match of text.matchAll(monthDayRe)) {
    const key = stripDiacritics(match[2].toLowerCase());
    const month = EN_MONTHS[key] ?? (pt ? PT_MONTHS[key] : undefined);
    if (!month || (AMBIGUOUS_PT_ABBR.has(key) && !EN_MONTHS[key])) continue;
    const year = match[4] ? Number(match[4]) : undefined;
    const day = Number(match[3]);
    pushDate(out, match, year !== undefined ? makeDate(year, month, day) : rollForward(month, day, today));
  }

  return out;
}

const TIME_LEAD = String.raw`(?:(?:${NB}(?:às|ás|as|at)|@)\s*)?`;

function collectTimes(text: string, pt: boolean): TimeCandidate[] {
  const out: TimeCandidate[] = [];
  const push = (match: RegExpMatchArray, hour: number, minute: number, needsDate = false) => {
    if (match.index === undefined || minute < 0 || minute > 59 || hour < 0 || hour > 23) return;
    out.push({ start: match.index, end: match.index + match[0].length, hour, minute, needsDate });
  };
  const to24 = (hour: number, meridiem: string | undefined): number | null => {
    if (!meridiem) return hour;
    if (hour < 1 || hour > 12) return null;
    const pm = meridiem.toLowerCase().startsWith("p");
    if (pm) return hour === 12 ? 12 : hour + 12;
    return hour === 12 ? 0 : hour;
  };

  // 18:30, 6:30pm, às 18:30, 18:30h
  const colonRe = new RegExp(
    `${TIME_LEAD}(?<![\\d:])(\\d{1,2})\\s*:\\s*(\\d{2})(?!\\d|:\\d)(?:\\s*(am|pm|a\\.m\\.|p\\.m\\.)|h${NA})?`,
    "giu",
  );
  for (const match of text.matchAll(colonRe)) {
    const hour = to24(Number(match[1]), match[3]?.replace(/\./g, ""));
    if (hour !== null) push(match, hour, Number(match[2]));
  }

  // 18h30, 18h, às 18h
  const hRe = new RegExp(`${TIME_LEAD}(?<![\\d:])(\\d{1,2})h(\\d{2})?${NA}`, "giu");
  for (const match of text.matchAll(hRe)) {
    const hasLead = /^(?:às|ás|as|at|@)/iu.test(match[0]);
    push(match, Number(match[1]), match[2] ? Number(match[2]) : 0, !match[2] && !hasLead);
  }

  // 6pm, 6 pm, at 6 pm
  const meridiemRe = new RegExp(`${TIME_LEAD}(?<![\\d:])(\\d{1,2})\\s*(am|pm|a\\.m\\.|p\\.m\\.)${NA}`, "giu");
  for (const match of text.matchAll(meridiemRe)) {
    const hour = to24(Number(match[1]), match[2].replace(/\./g, ""));
    if (hour !== null) push(match, hour, 0);
  }

  // Bare hour behind a lead word: "às 18", "at 18"
  const leadWords = pt ? "às|ás|as" : "at|às|ás";
  const bareRe = new RegExp(`${NB}(?:${leadWords})\\s+(\\d{1,2})(?![\\d:/.\\-]|\\s*(?:am|pm|h\\b|a\\.m|p\\.m))${NA}`, "giu");
  for (const match of text.matchAll(bareRe)) {
    push(match, Number(match[1]), 0);
  }

  // Named times.
  const namedRe = new RegExp(`${TIME_LEAD}${NB}(meio[- ]dia|noon|midday|meia[- ]noite|midnight)${NA}`, "giu");
  for (const match of text.matchAll(namedRe)) {
    const word = stripDiacritics(match[1].toLowerCase());
    push(match, word.includes("dia") || word === "noon" || word === "midday" ? 12 : 0, 0);
  }

  return out;
}

function overlaps(a: NaturalDateSpan, b: NaturalDateSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Keep the longest candidate of any overlapping group. */
function resolveOverlaps<T extends NaturalDateSpan>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const kept: T[] = [];
  for (const item of sorted) {
    if (!kept.some((other) => overlaps(item, other))) kept.push(item);
  }
  return kept.sort((a, b) => a.start - b.start);
}

const GAP_FILLER = /^(?:[\s,]|(?:às|ás|as|at|@|em|de|da|do|on|the)(?![\p{L}\p{N}]))*$/iu;

/** True when only spaces/commas/lead words separate the two spans. */
function isAdjacent(text: string, a: NaturalDateSpan, b: NaturalDateSpan): boolean {
  const [first, second] = a.start <= b.start ? [a, b] : [b, a];
  return GAP_FILLER.test(text.slice(first.end, second.start));
}

export function parseNaturalDate(text: string, options: ParseNaturalDateOptions): NaturalDateMatch | null {
  const { now, locale } = options;
  const pt = isPt(locale);
  const today = new Date(startOfLocalDay(now));

  const dates = resolveOverlaps(collectDates(text, today, pt, now));
  // A time inside a date span (e.g. "10.30.2027") is not a time.
  const times = resolveOverlaps(collectTimes(text, pt)).filter(
    (time) => !dates.some((date) => overlaps(time, date)),
  );

  const date = dates.length > 0 ? dates[dates.length - 1] : null;

  let time: TimeCandidate | null = null;
  if (date) {
    // A bare "2h" only counts right after the date ("03/11 18h"); before it ("2h hoje") it is a duration.
    const usable = times.filter(
      (candidate) => !candidate.needsDate || (candidate.start >= date.end && isAdjacent(text, date, candidate)),
    );
    // Prefer a time directly after the date, then directly before, then the nearest.
    const adjacent = usable.filter((candidate) => isAdjacent(text, date, candidate));
    const after = adjacent.find((candidate) => candidate.start >= date.end);
    time = after ?? adjacent[0] ?? usable[usable.length - 1] ?? null;
  } else {
    const standalone = times.filter((candidate) => !candidate.needsDate);
    time = standalone.length > 0 ? standalone[standalone.length - 1] : null;
  }

  if (!date && !time) return null;

  let due: Date;
  if (date) {
    due = new Date(date.date);
  } else {
    due = new Date(today);
  }
  if (time) {
    due.setHours(time.hour, time.minute, 0, 0);
    // A bare time that already passed today means tomorrow.
    if (!date && due.getTime() < now) due.setDate(due.getDate() + 1);
  }

  const rawSpans: NaturalDateSpan[] = [];
  if (date) rawSpans.push({ start: date.start, end: date.end });
  if (time) rawSpans.push({ start: time.start, end: time.end });
  rawSpans.sort((a, b) => a.start - b.start);

  let spans = rawSpans;
  if (rawSpans.length === 2 && isAdjacent(text, rawSpans[0], rawSpans[1])) {
    spans = [{ start: rawSpans[0].start, end: rawSpans[1].end }];
  }

  const start = spans[0].start;
  const end = spans[spans.length - 1].end;
  return {
    start,
    end,
    spans,
    dueMs: due.getTime(),
    hasTime: time !== null,
    matchedText: text.slice(start, end).trim(),
  };
}

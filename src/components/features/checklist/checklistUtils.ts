import type { ChecklistPriority } from "@/types";
import { parseNaturalDate } from "@/utils/naturalDate";

const TAG_PATTERN = /#([\p{L}\p{N}_-]+)/gu;
const CATEGORY_PATTERN = /(?:^|\s)@(?:"([^"]+)"|([\p{L}\p{N}_][\p{L}\p{N}_\s-]*))/u;
const PRIORITY_PATTERN = /(?:^|\s)!([\p{L}\p{N}]+)/gu;

export type EntryHighlightKind = "date" | "category" | "priority" | "tag";

export interface EntryHighlight {
  start: number;
  end: number;
  kind: EntryHighlightKind;
}

export interface ParseEntryOptions {
  now: number;
  locale: string;
  dateRecognition: boolean;
  rejectDate?: boolean;
}

export interface ParsedEntry {
  title: string;
  tags: string[];
  category: string | null;
  priority: ChecklistPriority;
  due: { ms: number; hasTime: boolean } | null;
  highlights: EntryHighlight[];
}

function parsePriorityToken(token: string): ChecklistPriority {
  const lower = token.toLowerCase();
  if (["1", "urgent", "urgente"].includes(lower)) return "urgent";
  if (["2", "high", "alta"].includes(lower)) return "high";
  if (["3", "medium", "media", "média"].includes(lower)) return "medium";
  if (["4", "low", "baixa"].includes(lower)) return "low";
  return "none";
}

/** Split inline syntax into structured fields (spec: checklist-organization). */
export function parseEntry(raw: string, options: ParseEntryOptions): ParsedEntry {
  let text = raw;
  const highlights: EntryHighlight[] = [];
  const tags: string[] = [];
  let category: string | null = null;
  let priority: ChecklistPriority = "none";
  let due: { ms: number; hasTime: boolean } | null = null;

  for (const match of text.matchAll(TAG_PATTERN)) {
    const tag = match[1];
    if (tag && !tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      tags.push(tag);
    }
    if (match.index !== undefined) {
      highlights.push({ start: match.index, end: match.index + match[0].length, kind: "tag" });
    }
  }

  const categoryMatch = CATEGORY_PATTERN.exec(text);
  if (categoryMatch) {
    category = (categoryMatch[1] ?? categoryMatch[2] ?? "").trim();
    if (categoryMatch.index !== undefined) {
      highlights.push({
        start: categoryMatch.index,
        end: categoryMatch.index + categoryMatch[0].length,
        kind: "category",
      });
    }
  }

  for (const match of text.matchAll(PRIORITY_PATTERN)) {
    const parsed = parsePriorityToken(match[1]);
    if (parsed !== "none") {
      priority = parsed;
      if (match.index !== undefined) {
        highlights.push({ start: match.index, end: match.index + match[0].length, kind: "priority" });
      }
      break;
    }
  }

  if (options.dateRecognition && !options.rejectDate) {
    const dateMatch = parseNaturalDate(text, { now: options.now, locale: options.locale });
    if (dateMatch) {
      due = { ms: dateMatch.dueMs, hasTime: dateMatch.hasTime };
      for (const span of dateMatch.spans) {
        highlights.push({ start: span.start, end: span.end, kind: "date" });
      }
    }
  }

  let title = text;
  const removals = [...highlights].sort((a, b) => b.start - a.start);
  for (const span of removals) {
    title = title.slice(0, span.start) + title.slice(span.end);
  }
  title = title.replace(/\s{2,}/g, " ").trim();

  return { title, tags, category, priority, due, highlights };
}

/** Split "Review PR #work #urgent" into a clean title and its inline tags. */
export function parseInlineTags(raw: string): { title: string; tags: string[] } {
  const { title, tags } = parseEntry(raw, {
    now: Date.now(),
    locale: "en-US",
    dateRecognition: false,
  });
  return { title, tags };
}

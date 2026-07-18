const TAG_PATTERN = /#([\p{L}\p{N}_-]+)/gu;

/** Split "Review PR #work #urgent" into a clean title and its inline tags. */
export function parseInlineTags(raw: string): { title: string; tags: string[] } {
  const tags: string[] = [];
  for (const match of raw.matchAll(TAG_PATTERN)) {
    const tag = match[1];
    if (tag && !tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      tags.push(tag);
    }
  }
  const title = raw.replace(TAG_PATTERN, "").replace(/\s{2,}/g, " ").trim();
  return { title, tags };
}

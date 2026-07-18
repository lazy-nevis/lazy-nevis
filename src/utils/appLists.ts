/**
 * Parses a pasted bulk list of app/process names: one per line, or separated by
 * commas/semicolons. Trims entries, drops empties, and dedupes case-insensitively
 * (both within the pasted text and against `existing`).
 * Spec: focus-rules/user-extendable-ignore-list.
 */
export function parseAppList(text: string, existing: string[] = []): string[] {
  const seen = new Set(existing.map((name) => name.toLowerCase()));
  const result: string[] = [];
  for (const raw of text.split(/[\n,;]+/)) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

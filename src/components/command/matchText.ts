/** Case- and diacritic-insensitive substring match for command palette search. */
export function normalizeMatchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function matchText(haystack: string, query: string): boolean {
  const q = normalizeMatchText(query.trim());
  if (!q) return true;
  return normalizeMatchText(haystack).includes(q);
}

export type MarkdownFormat = "bold" | "italic" | "bullet" | "numbered";

export interface FormatResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

const WRAP: Record<"bold" | "italic", string> = { bold: "**", italic: "_" };

/** Applies an inline wrap or a line-prefix list format to the selected range. */
export function applyMarkdownFormat(
  text: string,
  start: number,
  end: number,
  format: MarkdownFormat,
): FormatResult {
  if (format === "bold" || format === "italic") {
    const mark = WRAP[format];
    const selected = text.slice(start, end);
    const before = text.slice(0, start);
    const after = text.slice(end);
    if (before.endsWith(mark) && after.startsWith(mark)) {
      return {
        value: before.slice(0, -mark.length) + selected + after.slice(mark.length),
        selectionStart: start - mark.length,
        selectionEnd: end - mark.length,
      };
    }
    return {
      value: before + mark + selected + mark + after,
      selectionStart: start + mark.length,
      selectionEnd: end + mark.length,
    };
  }

  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = text.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const lines = text.slice(lineStart, lineEnd).split("\n");
  const pattern = format === "bullet" ? /^- / : /^\d+\. /;
  const allPrefixed = lines.every((line) => pattern.test(line));
  const next = lines.map((line, index) => {
    const bare = line.replace(/^(- |\d+\. )/, "");
    if (allPrefixed) return bare;
    return format === "bullet" ? `- ${bare}` : `${index + 1}. ${bare}`;
  });
  const block = next.join("\n");
  return {
    value: text.slice(0, lineStart) + block + text.slice(lineEnd),
    selectionStart: lineStart,
    selectionEnd: lineStart + block.length,
  };
}

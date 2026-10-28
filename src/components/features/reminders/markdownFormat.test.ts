import { describe, expect, it } from "vitest";
import { applyMarkdownFormat } from "@/components/features/reminders/markdownFormat";

describe("applyMarkdownFormat", () => {
  it("wraps and unwraps bold selections", () => {
    const wrapped = applyMarkdownFormat("hello world", 6, 11, "bold");
    expect(wrapped.value).toBe("hello **world**");
    expect(wrapped.value.slice(wrapped.selectionStart, wrapped.selectionEnd)).toBe("world");
    const unwrapped = applyMarkdownFormat(wrapped.value, wrapped.selectionStart, wrapped.selectionEnd, "bold");
    expect(unwrapped.value).toBe("hello world");
  });

  it("inserts italic markers at the caret", () => {
    expect(applyMarkdownFormat("ab", 1, 1, "italic").value).toBe("a__b");
  });

  it("toggles bullet and numbered prefixes across lines", () => {
    const text = "one\ntwo\nthree";
    const bullets = applyMarkdownFormat(text, 0, text.length, "bullet");
    expect(bullets.value).toBe("- one\n- two\n- three");
    expect(applyMarkdownFormat(bullets.value, 0, bullets.value.length, "bullet").value).toBe(text);
    expect(applyMarkdownFormat(text, 4, 7, "numbered").value).toBe("one\n1. two\nthree");
    expect(applyMarkdownFormat(bullets.value, 0, bullets.value.length, "numbered").value).toBe(
      "1. one\n2. two\n3. three",
    );
  });
});

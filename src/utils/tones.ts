import type { CSSProperties } from "react";

/**
 * Named accent tones shared by checklist categories, habits, reminders, and calendar
 * markers. Values live in `src/index.css` as `--tone-<name>` HSL triplets so light/dark
 * themes can tune them; persisted data stores only the tone name.
 */
export const TONES = [
  "slate",
  "sky",
  "violet",
  "rose",
  "orange",
  "amber",
  "emerald",
  "teal",
] as const;

export type Tone = (typeof TONES)[number];

export const DEFAULT_TONE: Tone = "slate";

export function isTone(value: unknown): value is Tone {
  return typeof value === "string" && (TONES as readonly string[]).includes(value);
}

export function toTone(value: unknown): Tone {
  return isTone(value) ? value : DEFAULT_TONE;
}

/** `hsl(...)` color string for a tone, optionally with alpha (0–1). */
export function toneColor(tone: Tone, alpha?: number): string {
  return alpha === undefined
    ? `hsl(var(--tone-${tone}))`
    : `hsl(var(--tone-${tone}) / ${alpha})`;
}

/**
 * Inline style that binds `--tone` for the `.tone-*` utility classes in `index.css`
 * (`tone-dot`, `tone-text`, `tone-soft`, `tone-border`, `tone-glow`).
 */
export function toneStyle(tone: Tone): CSSProperties {
  return { "--tone": `var(--tone-${tone})` } as CSSProperties;
}

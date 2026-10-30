---
type: concept
title: checklist-todoist-card — spec
description: Todoist-style checklist: flat divider list, entry card with chips and a "+" menu, floating pickers, and a flexible date/time parser.
tags: [change, spec, checklist, ux, parser]
---

# Spec — checklist-todoist-card

## Problem

- Open items render as bordered cards with inline category/priority selects; adding an item is a
  single-line input. It feels heavy next to Todoist.
- The category and priority selects open inside the card and push the layout down, and the open
  list does not make the selected option obvious.
- Recognized date text is highlighted with `bg-muted/60`, nearly the background color.
- The date parser reads `dia 10/11` as `dia 10` and leaves `/11` in the title; time without a date
  and many numeric date shapes are not recognized.

## Expected behavior

1. **List.** Open items are flat rows separated by a hairline divider (no card, no border box).
   The round checkbox stays. A card only appears for adding or editing an item.
2. **Entry card.** One card (create and edit share it) holds a borderless auto-growing
   `textarea` (Enter submits, Shift+Enter inserts a line break, Esc cancels or first ignores a
   recognized date). Under it: chips for category, date, time, priority and tags, then a footer
   with a `+` button (left) and Cancel / Add (or Save) (right).
3. **`+` menu.** A floating popover (portal, `position: fixed`, flips above when needed) lists
   Priority, Category, Due date and Tags. Each entry switches the same popover to its picker. Chips
   open the matching picker directly. Pickers never push the layout; the selected option is
   highlighted (accent background, check mark, `aria-selected`).
4. **Highlight.** Recognized date/time text in the textarea uses a strong highlight (`primary`
   tinted background with foreground text); `@category`, `!priority` and `#tag` tokens use a lighter
   primary tint.
5. **Edit.** Clicking an item title replaces the row with the same card prefilled (title, category,
   priority, tags, due). The primary button is "Save" and calls `update`.
6. **Compact.** Compact mode (Compact Mode window, tray popover) uses the same card with tighter
   spacing and icon-only footer buttons, and a flat divider list with a smaller row.
7. **Parser.** `parseNaturalDate` recognizes, in pt-BR and en-US:
   - numeric dates `D/M`, `D/M/YY`, `D/M/YYYY`, `YYYY/M/D`, `YYYY-MM-DD`, with separators `/`, `-`,
     `.` (see ambiguity rules), optionally preceded by `dia`, `até`, `by`, `on`, `due`…;
   - day only (`dia 5`, `the 5th`): the next occurrence of that day-of-month;
   - month names (`3 de novembro`, `3 nov 2027`, `nov 3rd`), weekdays, `hoje/amanhã/today/tomorrow`,
     offsets (`em 2 dias`, `in 3 weeks`);
   - time with or without a date: `18:30`, `18h30`, `18h`, `às 18h`, `at 6pm`, `6 pm`, `às 18`,
     `meio-dia`, `noon`, `meia-noite`, `midnight`.

### Parser rules

- pt-BR reads `D/M[/Y]`; en-US reads `M/D[/Y]` and falls back to `D/M` when the first number is > 12.
- Bare numbers are never dates. A two-part date with `-` or `.` needs a lead word (`dia`, `até`,
  `by`…); a bare `D/M` is accepted. A `.` date needs a 4-digit year unless it has a lead word.
- Invalid calendar dates (`31/02`, `13/13`, `99/99`) are rejected, not truncated.
- Two-digit years are `2000 + YY`. Without a year the date rolls to next year when it already
  passed; day-only rolls to the next month that has that day.
- A bare `18h` (no minutes, no lead word) only counts as a time when adjacent to a date, so
  durations such as `estudar 2h` stay in the title.
- A time with no date means today, or tomorrow when that time has already passed.
- When several dates match, the last wins. Date and time spans are both highlighted and removed
  from the title; adjacent date+time merge into one span.

## Out of scope

- Rust/DB changes (no schema or command change), recurring dates, attachments/deadline/location
  fields from the Todoist screenshot.

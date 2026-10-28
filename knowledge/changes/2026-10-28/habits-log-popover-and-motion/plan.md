---
type: concept
title: habits-log-popover-and-motion — plan
description: Implementation plan for the quick-log popover, met state and app-wide Motion feedback.
tags: [change, plan, habits, motion]
---

# Plan — habits-log-popover-and-motion

The work is split into two streams with disjoint files.

1. **Motion foundation and app-wide feedback**
   - Add the dependencies `canvas-confetti` and `@types/canvas-confetti`.
   - Create `src/components/ui/motion/` with `AnimatedNumber.tsx`, `AnimatedProgress.tsx`,
     `celebrate.ts`, `PopIn.tsx` and `index.ts`.
   - Add `MotionConfig` at the root in `src/main.tsx` or `App.tsx`.
   - Dashboard: `DragOverlay` lift, plus animated tiles in `src/pages/Dashboard.tsx` and
     `src/components/features/dashboard/*`.
   - Pomodoro page goal and checklist completion pop/celebrate.
   - Adds no i18n keys.
2. **Habits**
   - Add `HabitLogPopover.tsx` and a `ValueStepper.tsx`, and rework `HabitLogForm.tsx` to use the
     steppers, with "More" collapsed.
   - `HabitCard.tsx`: met badge, button variants, `AnimatedProgress` and `AnimatedNumber`,
     `celebrate` on crossing to met.
   - `HabitsPage.tsx`: popover instead of `HabitLogDialog`, plus an error toast.
   - Reproduce and fix the input bug.
   - Owns all i18n keys in `en-US.json` and `pt-BR.json`.
3. **Docs:** update `knowledge/product/capabilities/habit-tracking.md` for the popover and the
   met state.
4. **Validate** with `bun run test`, `bun run build`, `cargo test` and `bun run quality`, then
   check in `dev:demo`.

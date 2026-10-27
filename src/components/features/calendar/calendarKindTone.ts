import type { CalendarEntry, CalendarKind } from "@/types";
import type { Tone } from "@/utils/tones";
import { toTone } from "@/utils/tones";

/** Default accent tone for a calendar entry kind (grid markers, legend chips). */
export function calendarKindTone(kind: CalendarKind, entry?: CalendarEntry): Tone {
  if (entry?.kind === "reminder_occurrence") return toTone(entry.tone);
  if (entry?.kind === "checklist_completed" || entry?.kind === "checklist_due") {
    return toTone(entry.tone ?? "slate");
  }
  if (entry?.kind === "habit_day" || entry?.kind === "habit_log") {
    return toTone(entry.tone);
  }
  switch (kind) {
    case "session":
      return "sky";
    case "pomodoro_run":
      return "violet";
    case "checklist_completed":
    case "checklist_due":
      return "emerald";
    case "habit_day":
    case "habit_log":
      return "teal";
    case "reminder_occurrence":
      return "amber";
    default:
      return "slate";
  }
}

import type { LucideIcon } from "lucide-react";
import { ListChecks, Target } from "lucide-react";

export type CompactSegmentId = "checklist" | "habits";

export interface CompactSegmentMeta {
  id: CompactSegmentId;
  labelKey: string;
  icon: LucideIcon;
}

/** Segment registry for Compact Mode lower block (orchestrator appends entries). */
export const COMPACT_SEGMENTS: CompactSegmentMeta[] = [
  { id: "checklist", labelKey: "checklist.open_title", icon: ListChecks },
  { id: "habits", labelKey: "nav.habits", icon: Target },
];

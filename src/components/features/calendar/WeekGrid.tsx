import type { CalendarEntry, CalendarKind } from "@/types";
import { weekDateKeys } from "./calendarMath";
import { TimeGrid } from "./TimeGrid";

export interface WeekGridProps {
  anchor: Date;
  weekStart: 0 | 1;
  entries: CalendarEntry[];
  visibleKinds: CalendarKind[];
  selectedDate: string | null;
  locale: string;
  onSelectDate: (date: string) => void;
  onSessionClick?: (sessionId: string) => void;
}

export function WeekGrid({
  anchor,
  weekStart,
  entries,
  visibleKinds,
  selectedDate,
  locale,
  onSelectDate,
  onSessionClick,
}: WeekGridProps) {
  const dateKeys = weekDateKeys(anchor, weekStart);

  return (
    <TimeGrid
      dateKeys={dateKeys}
      entries={entries}
      visibleKinds={visibleKinds}
      selectedDate={selectedDate}
      locale={locale}
      onSelectDate={onSelectDate}
      onSessionClick={onSessionClick}
    />
  );
}

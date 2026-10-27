import type { CalendarEntry, CalendarKind } from "@/types";
import { TimeGrid } from "./TimeGrid";

export interface DayTimeGridProps {
  dateKey: string;
  entries: CalendarEntry[];
  visibleKinds: CalendarKind[];
  locale: string;
  onSessionClick?: (sessionId: string) => void;
}

export function DayTimeGrid({
  dateKey,
  entries,
  visibleKinds,
  locale,
  onSessionClick,
}: DayTimeGridProps) {
  return (
    <TimeGrid
      dateKeys={[dateKey]}
      entries={entries}
      visibleKinds={visibleKinds}
      selectedDate={dateKey}
      locale={locale}
      onSelectDate={() => {}}
      onSessionClick={onSessionClick}
    />
  );
}

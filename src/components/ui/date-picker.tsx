import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/utils/cn";

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD` for a local Date. */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses `YYYY-MM-DD` as a local date; null when malformed. */
export function parseDateKey(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Normalizes `H:MM`/`HH:MM` to `HH:MM`; null when malformed. */
export function normalizeTime(value: string | null | undefined): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value?.trim() ?? "");
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return `${pad(h)}:${pad(m)}`;
}

export function CalendarGrid({
  value,
  onSelect,
  weekStart,
}: {
  value: Date | null;
  onSelect: (date: Date) => void;
  weekStart: 0 | 1;
}) {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: "pickers" });
  const today = new Date();
  const [view, setView] = useState(() => {
    const base = value ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const year = view.getFullYear();
  const month = view.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (view.getDay() - weekStart + 7) % 7;
  const weekdayFmt = new Intl.DateTimeFormat(i18n.language, { weekday: "narrow" });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    weekdayFmt.format(new Date(2024, 0, 7 + ((i + weekStart) % 7))),
  );
  const selectedKey = value ? toDateKey(value) : null;
  const todayKey = toDateKey(today);

  return (
    <div className="w-[248px]">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label={t("prev_month")}
          onClick={() => setView(new Date(year, month - 1, 1))}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold capitalize">
          {new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }).format(view)}
        </span>
        <button
          type="button"
          aria-label={t("next_month")}
          onClick={() => setView(new Date(year, month + 1, 1))}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
        {weekdays.map((label, i) => (
          <span key={i} className="py-1 font-medium text-muted-foreground">
            {label}
          </span>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = new Date(year, month, i + 1);
          const key = toDateKey(date);
          const selected = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(date)}
              aria-pressed={selected}
              className={cn(
                "flex h-8 items-center justify-center rounded-md tabular-nums transition-colors",
                selected
                  ? "bg-brand font-semibold text-brand-foreground"
                  : "hover:bg-accent",
                !selected && key === todayKey && "font-semibold text-brand ring-1 ring-brand/40",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));

export function TimeColumns({ value, onChange }: { value: string | null; onChange: (time: string) => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "pickers" });
  const [hour, minute] = (value ?? "09:00").split(":");
  const minutes = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort();
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll only the column itself; scrollIntoView would also scroll the enclosing dialog.
    for (const ref of [hourRef, minuteRef]) {
      const column = ref.current;
      const selected = column?.querySelector<HTMLElement>("[aria-pressed='true']");
      if (column && selected) {
        column.scrollTop = selected.offsetTop - column.clientHeight / 2 + selected.clientHeight / 2;
      }
    }
  }, []);

  const column = (
    label: string,
    items: string[],
    selected: string,
    onPick: (item: string) => void,
    ref: React.RefObject<HTMLDivElement | null>,
  ) => (
    <div className="flex flex-col">
      <span className="pb-1 text-center text-[11px] font-medium text-muted-foreground">{label}</span>
      <div ref={ref} className="scrollbar-none relative flex h-[216px] w-14 flex-col gap-0.5 overflow-y-auto">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={item === selected}
            onClick={() => onPick(item)}
            className={cn(
              "shrink-0 rounded-md py-1.5 text-sm tabular-nums transition-colors",
              item === selected ? "bg-brand font-semibold text-brand-foreground" : "hover:bg-accent",
            )}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex gap-1">
      {column(t("hour"), HOURS, hour, (h) => onChange(`${h}:${minute}`), hourRef)}
      {column(t("minute"), minutes, minute, (m) => onChange(`${hour}:${m}`), minuteRef)}
    </div>
  );
}

function ClearButton({ onClear }: { onClear: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "pickers" });
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={t("clear")}
      title={t("clear")}
      onClick={(event) => {
        event.stopPropagation();
        onClear();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onClear();
        }
      }}
      className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <X className="h-3.5 w-3.5" />
    </span>
  );
}

/** Date field (`YYYY-MM-DD`) with a month-grid popover. */
export function DatePicker({
  value,
  onChange,
  weekStart = 1,
  placeholder,
  clearable = true,
  className,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  weekStart?: 0 | 1;
  placeholder?: string;
  clearable?: boolean;
  className?: string;
}) {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: "pickers" });
  const date = parseDateKey(value);
  const label = date
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(date)
    : (placeholder ?? t("pick_date"));

  return (
    <Popover
      ariaLabel={placeholder ?? t("pick_date")}
      triggerClassName={cn("w-full justify-start", className)}
      trigger={
        <>
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={cn("truncate", !date && "text-muted-foreground")}>{label}</span>
          {clearable && date && <ClearButton onClear={() => onChange(null)} />}
        </>
      }
    >
      {(close) => (
        <div className="space-y-2">
          <CalendarGrid
            value={date}
            weekStart={weekStart}
            onSelect={(picked) => {
              onChange(toDateKey(picked));
              close();
            }}
          />
          <button
            type="button"
            onClick={() => {
              onChange(toDateKey(new Date()));
              close();
            }}
            className="w-full rounded-md py-1 text-xs font-medium text-brand hover:bg-accent"
          >
            {t("today")}
          </button>
        </div>
      )}
    </Popover>
  );
}

/** Time field (`HH:MM`) with hour/minute column popover. */
export function TimePicker({
  value,
  onChange,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "pickers" });
  const normalized = normalizeTime(value);
  return (
    <Popover
      ariaLabel={ariaLabel ?? t("pick_time")}
      triggerClassName={cn("w-[104px] justify-start", className)}
      trigger={
        <>
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={cn("tabular-nums", !normalized && "text-muted-foreground")}>
            {normalized ?? "--:--"}
          </span>
        </>
      }
    >
      {() => <TimeColumns value={normalized} onChange={onChange} />}
    </Popover>
  );
}

/** Date + time field (`YYYY-MM-DDTHH:MM`) — calendar and time columns side by side. */
export function DateTimePicker({
  value,
  onChange,
  weekStart = 1,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  weekStart?: 0 | 1;
  className?: string;
}) {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: "pickers" });
  const date = parseDateKey(value);
  const time = normalizeTime(value.slice(11, 16)) ?? "09:00";
  const label = date
    ? `${new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(date)} · ${time}`
    : t("pick_datetime");
  const emit = (nextDate: Date | null, nextTime: string) =>
    onChange(`${toDateKey(nextDate ?? new Date())}T${nextTime}`);

  return (
    <Popover
      ariaLabel={t("pick_datetime")}
      triggerClassName={cn("w-full justify-start", className)}
      trigger={
        <>
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={cn("truncate", !date && "text-muted-foreground")}>{label}</span>
        </>
      }
    >
      {() => (
        <div className="flex gap-3">
          <CalendarGrid value={date} weekStart={weekStart} onSelect={(picked) => emit(picked, time)} />
          <div className="border-l border-border pl-3">
            <TimeColumns value={time} onChange={(nextTime) => emit(date, nextTime)} />
          </div>
        </div>
      )}
    </Popover>
  );
}

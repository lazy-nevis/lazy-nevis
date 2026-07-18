/** Start of the local day containing `ms` (epoch milliseconds). */
export function startOfLocalDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** End of the local day containing `ms` (inclusive, epoch milliseconds). */
export function endOfLocalDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole local days elapsed since `ms` (0 = today). */
export function daysAgo(ms: number, now = Date.now()): number {
  return Math.max(0, Math.round((startOfLocalDay(now) - startOfLocalDay(ms)) / DAY_MS));
}

/** Shift an epoch-ms timestamp by whole days, keeping the time of day. */
export function shiftDays(ms: number, days: number): number {
  const date = new Date(ms);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

/** `YYYY-MM-DD` in local time, for `<input type="date">`. */
export function toDateInputValue(ms: number): string {
  const date = new Date(ms);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parse `YYYY-MM-DD` (local) to the start of that day, or null when empty/invalid. */
export function fromDateInputValue(value: string): number | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day).getTime();
}

/** Format milliseconds as HH:MM:SS */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** Format milliseconds as a human-readable string like "2h 30m" */
export function formatDurationHuman(ms: number, locale = "en-US"): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const minuteUnit = locale === "pt-BR" ? "min" : "m";
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}${minuteUnit}`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}${minuteUnit}`;
  return `${Math.floor(ms / 1000)}s`;
}

/**
 * Format a Unix timestamp (ms) as a locale date string.
 * pt-BR → DD/MM/YYYY   |   en-US → MM/DD/YYYY
 */
export function formatDate(ms: number, locale: string): string {
  if (locale === "pt-BR") {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
    }).format(new Date(ms));
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit", day: "2-digit", year: "numeric",
  }).format(new Date(ms));
}

/**
 * Format a Unix timestamp (ms) as a time string (HH:MM:SS).
 */
export function formatTime(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

/**
 * Format a Unix timestamp (ms) as date + time.
 * pt-BR → DD/MM/YYYY HH:mm:ss   |   en-US → MM/DD/YYYY HH:mm:ss
 */
export function formatDateTime(ms: number, locale: string): string {
  if (locale === "pt-BR") {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).format(new Date(ms));
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit", day: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

/** Format a focus percentage (0–100) */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Overview Dashboard widget order/size, persisted per device in localStorage.
 * Parsing is defensive: anything unknown or malformed falls back to defaults so
 * a bad stored value can never break the Dashboard.
 */

export const WIDGET_IDS = [
  "hero",
  "stats",
  "habits",
  "calendar",
  "checklist_today",
  "reminders_today",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

/** Column span on the 6-column grid: third, half, or full width. */
export type WidgetSize = "sm" | "md" | "lg";

export const WIDGET_SIZES: readonly WidgetSize[] = ["sm", "md", "lg"];

export interface DashboardLayout {
  order: WidgetId[];
  sizes: Record<WidgetId, WidgetSize>;
}

export const DEFAULT_LAYOUT: DashboardLayout = {
  order: [...WIDGET_IDS],
  sizes: {
    hero: "lg",
    stats: "lg",
    habits: "lg",
    calendar: "sm",
    checklist_today: "sm",
    reminders_today: "sm",
  },
};

export const LAYOUT_STORAGE_KEY = "lazynevis.dashboard.layout.v1";

function isWidgetId(value: unknown): value is WidgetId {
  return typeof value === "string" && (WIDGET_IDS as readonly string[]).includes(value);
}

function isWidgetSize(value: unknown): value is WidgetSize {
  return typeof value === "string" && (WIDGET_SIZES as readonly string[]).includes(value);
}

export function parseLayout(raw: string | null): DashboardLayout {
  if (!raw) return DEFAULT_LAYOUT;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_LAYOUT;
  }
  if (typeof parsed !== "object" || parsed === null) return DEFAULT_LAYOUT;
  const record = parsed as { order?: unknown; sizes?: unknown };

  const order: WidgetId[] = [];
  if (Array.isArray(record.order)) {
    for (const id of record.order) {
      if (isWidgetId(id) && !order.includes(id)) order.push(id);
    }
  }
  // Widgets added in later versions are appended so they still show up.
  for (const id of WIDGET_IDS) if (!order.includes(id)) order.push(id);

  const sizes = { ...DEFAULT_LAYOUT.sizes };
  if (typeof record.sizes === "object" && record.sizes !== null) {
    for (const [id, size] of Object.entries(record.sizes)) {
      if (isWidgetId(id) && isWidgetSize(size)) sizes[id] = size;
    }
  }
  return { order, sizes };
}

export function loadLayout(): DashboardLayout {
  try {
    return parseLayout(window.localStorage.getItem(LAYOUT_STORAGE_KEY));
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveLayout(layout: DashboardLayout): void {
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* storage unavailable: layout stays in memory for this session */
  }
}

export function moveWidget(order: WidgetId[], from: WidgetId, to: WidgetId): WidgetId[] {
  const fromIndex = order.indexOf(from);
  const toIndex = order.indexOf(to);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return order;
  const next = [...order];
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, from);
  return next;
}

export function nextSize(size: WidgetSize): WidgetSize {
  return WIDGET_SIZES[(WIDGET_SIZES.indexOf(size) + 1) % WIDGET_SIZES.length];
}

export const SIZE_SPAN_CLASS: Record<WidgetSize, string> = {
  sm: "lg:col-span-2",
  md: "lg:col-span-3",
  lg: "lg:col-span-6",
};

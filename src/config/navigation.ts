import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  CalendarDays,
  History,
  Info,
  LayoutDashboard,
  ListChecks,
  Settings,
  Target,
  Timer,
} from "lucide-react";

export type NavBadge = "checklist-open" | "habits-pending";

export interface NavItemConfig {
  id: string;
  to: string;
  icon: LucideIcon;
  labelKey: string;
  badge?: NavBadge;
  shortcut?: string;
  end?: boolean;
  hidden?: boolean;
}

export interface NavGroupConfig {
  headingKey?: string;
  items: NavItemConfig[];
}

export const NAV_GROUPS: NavGroupConfig[] = [
  {
    items: [
      { id: "dashboard", to: "/", icon: LayoutDashboard, labelKey: "nav.dashboard", end: true },
    ],
  },
  {
    headingKey: "shell.group_plan",
    items: [
      {
        id: "checklist",
        to: "/checklist",
        icon: ListChecks,
        labelKey: "nav.checklist",
        badge: "checklist-open",
      },
      { id: "calendar", to: "/calendar", icon: CalendarDays, labelKey: "nav.calendar" },
      { id: "reminders", to: "/reminders", icon: BellRing, labelKey: "nav.reminders" },
    ],
  },
  {
    headingKey: "shell.group_track",
    items: [
      {
        id: "habits",
        to: "/habits",
        icon: Target,
        labelKey: "nav.habits",
        badge: "habits-pending",
      },
      { id: "pomodoro", to: "/pomodoro", icon: Timer, labelKey: "nav.pomodoro" },
      { id: "history", to: "/history", icon: History, labelKey: "nav.history" },
    ],
  },
];

export const NAV_BOTTOM: NavItemConfig[] = [
  { id: "settings", to: "/settings", icon: Settings, labelKey: "nav.settings", shortcut: "mod+," },
  { id: "about", to: "/about", icon: Info, labelKey: "nav.about", end: true },
];

export const ROUTE_TITLE_KEYS: Record<string, string> = {
  "/": "nav.dashboard",
  "/history": "nav.history",
  "/checklist": "nav.checklist",
  "/reminders": "nav.reminders",
  "/calendar": "nav.calendar",
  "/habits": "nav.habits",
  "/pomodoro": "nav.pomodoro",
  "/settings": "nav.settings",
  "/about": "nav.about",
};

export function flattenNavItems(options?: { pomodoroEnabled?: boolean }): NavItemConfig[] {
  const pomodoroEnabled = options?.pomodoroEnabled ?? true;
  const items: NavItemConfig[] = [];
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.id === "pomodoro" && !pomodoroEnabled) continue;
      if (!item.hidden) items.push(item);
    }
  }
  for (const item of NAV_BOTTOM) {
    if (!item.hidden) items.push(item);
  }
  return items;
}

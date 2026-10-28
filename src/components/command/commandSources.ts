import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { flattenNavItems } from "@/config/navigation";
import { useSettings } from "@/hooks/useSettings";
import {
  appModeService,
  habitService,
  overlayService,
  pomodoroService,
  sessionService,
} from "@/services/tauri";
import { useAppStatusStore } from "@/stores/appStatusStore";
import { useChecklistStore } from "@/stores/checklistStore";
import { useHabitStore } from "@/stores/habitStore";
import { usePomodoroStore } from "@/stores/pomodoroStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";

export interface CommandItem {
  id: string;
  groupKey: string;
  label: string;
  keywords?: string;
  onRun: () => void;
}

export type CommandSourceHook = () => CommandItem[];

export function useNavigationCommandSource(): CommandItem[] {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return useMemo(
    () =>
      flattenNavItems().map((item) => ({
        id: `nav-${item.id}`,
        groupKey: "command_palette.group_navigation",
        label: t(item.labelKey),
        keywords: item.labelKey,
        onRun: () => navigate(item.to),
      })),
    [navigate, t],
  );
}

export function useActionCommandSource(): CommandItem[] {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings, saveSettings } = useSettings();
  const activeSession = useSessionStore((s) => s.activeSession);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const resetCheckpoints = useSessionStore((s) => s.resetCheckpoints);
  const isFullscreen = useAppStatusStore((s) => s.isFullscreen);
  const setStartModalOpen = useUiStore((s) => s.setStartModalOpen);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);

  return useMemo(() => {
    const items: CommandItem[] = [];

    if (!activeSession) {
      items.push({
        id: "action-start-session",
        groupKey: "command_palette.group_actions",
        label: t("command_palette.start_session"),
        onRun: () => {
          setCommandPaletteOpen(false);
          setStartModalOpen(true);
        },
      });
    } else {
      items.push({
        id: "action-pause-resume",
        groupKey: "command_palette.group_actions",
        label: t("command_palette.pause_resume_session"),
        onRun: () => {
          void sessionService.pause();
        },
      });
      items.push({
        id: "action-stop-session",
        groupKey: "command_palette.group_actions",
        label: t("command_palette.stop_session"),
        onRun: () => {
          void sessionService.stop().then(async () => {
            await overlayService.cancelActive().catch(() => {});
            setActiveSession(null);
            resetCheckpoints();
          });
        },
      });
    }

    if (!isFullscreen) {
      items.push({
        id: "action-compact",
        groupKey: "command_palette.group_actions",
        label: t("app_modes.switch_to_compact"),
        onRun: () => void appModeService.setMode("compact"),
      });
    }

    items.push({
      id: "action-theme",
      groupKey: "command_palette.group_actions",
      label: t("command_palette.toggle_theme"),
      onRun: () => {
        const next =
          settings.general.theme === "light"
            ? "dark"
            : settings.general.theme === "dark"
              ? "system"
              : "light";
        saveSettings({ ...settings, general: { ...settings.general, theme: next } });
      },
    });

    items.push({
      id: "action-settings",
      groupKey: "command_palette.group_actions",
      label: t("nav.settings"),
      onRun: () => navigate("/settings"),
    });

    return items;
  }, [
    activeSession,
    isFullscreen,
    navigate,
    resetCheckpoints,
    saveSettings,
    setActiveSession,
    setCommandPaletteOpen,
    setStartModalOpen,
    settings,
    t,
  ]);
}

export function useChecklistCommandSource(): CommandItem[] {
  const navigate = useNavigate();
  const openItems = useChecklistStore((s) => s.openItems);

  return useMemo(
    () =>
      openItems.map((item) => ({
        id: `checklist-${item.id}`,
        groupKey: "command_palette.group_checklist",
        label: item.title,
        keywords: item.title,
        onRun: () => navigate("/checklist"),
      })),
    [navigate, openItems],
  );
}

export function usePomodoroCommandSource(): CommandItem[] {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pomodoroState = usePomodoroStore((s) => s.state);
  const setState = usePomodoroStore((s) => s.setState);

  return useMemo(() => {

    const items: CommandItem[] = [
      {
        id: "pomodoro-open",
        groupKey: "command_palette.group_pomodoro",
        label: t("command_palette.pomodoro_open"),
        onRun: () => navigate("/pomodoro"),
      },
    ];

    const run = pomodoroState?.run;
    const runState = pomodoroState?.state ?? null;

    if (!run) {
      items.push({
        id: "pomodoro-start",
        groupKey: "command_palette.group_pomodoro",
        label: t("command_palette.pomodoro_start"),
        onRun: () => {
          void pomodoroService.start({}).then(setState);
        },
      });
      return items;
    }

    if (runState === "running") {
      items.push({
        id: "pomodoro-pause",
        groupKey: "command_palette.group_pomodoro",
        label: t("command_palette.pomodoro_pause"),
        onRun: () => void pomodoroService.pause().then(setState),
      });
    } else if (runState === "paused") {
      items.push({
        id: "pomodoro-resume",
        groupKey: "command_palette.group_pomodoro",
        label: t("command_palette.pomodoro_resume"),
        onRun: () => void pomodoroService.resume().then(setState),
      });
    } else if (runState === "awaiting") {
      items.push({
        id: "pomodoro-start-next",
        groupKey: "command_palette.group_pomodoro",
        label: t("command_palette.pomodoro_start_next"),
        onRun: () => void pomodoroService.startNext().then(setState),
      });
    }

    items.push({
      id: "pomodoro-skip",
      groupKey: "command_palette.group_pomodoro",
      label: t("command_palette.pomodoro_skip"),
      onRun: () => void pomodoroService.skipPhase().then(setState),
    });
    items.push({
      id: "pomodoro-stop",
      groupKey: "command_palette.group_pomodoro",
      label: t("command_palette.pomodoro_stop"),
      onRun: () => void pomodoroService.stop().then(setState),
    });

    return items;
  }, [navigate, pomodoroState, setState, t]);
}

export function useHabitCommandSource(): CommandItem[] {
  const { t } = useTranslation();
  const today = useHabitStore((s) => s.today);

  return useMemo(
    () =>
      (today?.cards ?? []).map((card) => ({
        id: `habit-log-${card.habit.id}`,
        groupKey: "command_palette.group_habits",
        label: t("command_palette.log_habit", { name: card.habit.name }),
        keywords: card.habit.name,
        onRun: () => void habitService.openQuickLog(card.habit.id),
      })),
    [t, today],
  );
}

/** Pluggable sources — orchestrator appends hooks in `useCommandItems`. */
export const COMMAND_SOURCE_HOOKS: CommandSourceHook[] = [
  useNavigationCommandSource,
  useActionCommandSource,
  useChecklistCommandSource,
  useHabitCommandSource,
];

/** Merges all registered command sources (call only from CommandPalette). */
export function useCommandItems(): CommandItem[] {
  const navigation = useNavigationCommandSource();
  const actions = useActionCommandSource();
  const checklist = useChecklistCommandSource();
  const habits = useHabitCommandSource();
  const pomodoro = usePomodoroCommandSource();
  return useMemo(
    () => [...navigation, ...actions, ...checklist, ...habits, ...pomodoro],
    [navigation, actions, checklist, habits, pomodoro],
  );
}

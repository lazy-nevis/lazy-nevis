import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { habitService } from "@/services/tauri";
import type { Habit } from "@/types";
import { toneStyle, toTone } from "@/utils/tones";
import { cn } from "@/utils/cn";

export function HabitAllHabitsList({
  habits,
  onChanged,
  onEdit,
}: {
  habits: Habit[];
  onChanged: () => Promise<void>;
  onEdit: (habit: Habit) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "habits" });
  const navigate = useNavigate();
  const [order, setOrder] = useState(() => habits.map((h) => h.id));
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    setOrder((prev) => {
      const next = prev.filter((id) => habits.some((h) => h.id === id));
      for (const habit of habits) {
        if (!next.includes(habit.id)) next.push(habit.id);
      }
      return next;
    });
  }, [habits]);

  const sorted = order
    .map((id) => habits.find((h) => h.id === id))
    .filter((h): h is Habit => h != null);
  const missing = habits.filter((h) => !order.includes(h.id));
  const list = [...sorted, ...missing];

  const persist = async (ids: string[]) => {
    setOrder(ids);
    await habitService.reorder(ids);
    await onChanged();
  };

  const move = (id: string, delta: number) => {
    const ids = list.map((h) => h.id);
    const index = ids.indexOf(id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= ids.length) return;
    const copy = [...ids];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    void persist(copy);
  };

  const onDrop = (overId: string) => {
    const dragging = dragId.current;
    dragId.current = null;
    if (!dragging || dragging === overId) return;
    const ids = list.map((h) => h.id);
    const from = ids.indexOf(dragging);
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    const copy = [...ids];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    void persist(copy);
  };

  return (
    <div className="space-y-2">
      {list.map((habit) => (
        <div
          key={habit.id}
          className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-2 py-2 shadow-sm"
          draggable
          onDragStart={() => {
            dragId.current = habit.id;
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => onDrop(habit.id)}
        >
          <span className="cursor-grab text-muted-foreground" aria-hidden="true">
            <GripVertical className="h-4 w-4" />
          </span>
          <span
            className="tone-dot h-2.5 w-2.5 shrink-0 rounded-full"
            style={toneStyle(toTone(habit.tone))}
            aria-hidden
          />
          <button
            type="button"
            className={cn(
              "min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            onClick={() => navigate(`/habits/${habit.id}`)}
          >
            <p className="font-medium">{habit.name}</p>
            {!habit.active && (
              <span className="text-xs text-muted-foreground">{t("inactive_badge")}</span>
            )}
          </button>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("reorder_up")}
              onClick={() => move(habit.id, -1)}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("reorder_down")}
              onClick={() => move(habit.id, 1)}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button type="button" size="xs" variant="outline" onClick={() => onEdit(habit)}>
              {t("menu_edit")}
            </Button>
            <Switch
              checked={habit.active}
              onCheckedChange={(checked) =>
                void habitService.setActive(habit.id, checked).then(onChanged)
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
}

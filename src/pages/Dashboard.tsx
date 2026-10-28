import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import { GripVertical, Maximize2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/ui/page";
import {
  ChecklistTodayWidget,
  HabitsWidget,
  HeroWidget,
  MiniCalendarWidget,
  RemindersTodayWidget,
  StatsWidget,
} from "@/components/features/dashboard/DashboardWidgets";
import {
  DEFAULT_LAYOUT,
  SIZE_SPAN_CLASS,
  loadLayout,
  moveWidget,
  nextSize,
  saveLayout,
  type DashboardLayout,
  type WidgetId,
  type WidgetSize,
} from "@/components/features/dashboard/dashboardLayout";
import { useChecklistBuckets, useDashboardData } from "@/components/features/dashboard/useDashboardData";
import { useChecklist } from "@/hooks/useChecklist";
import { cn } from "@/utils/cn";

function SortableWidget({
  id,
  size,
  onResize,
  children,
}: {
  id: WidgetId;
  size: WidgetSize;
  onResize: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "overview" });
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/widget relative col-span-1 min-w-0",
        SIZE_SPAN_CLASS[size],
        isDragging && "z-20",
      )}
    >
      {isDragging && (
        <div
          className="pointer-events-none absolute inset-0 rounded-xl border-2 border-dashed border-border bg-muted/30"
          aria-hidden
        />
      )}
      <div className="absolute -top-2.5 right-2 z-10 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/widget:opacity-100">
        <button
          type="button"
          onClick={onResize}
          aria-label={t("layout.resize")}
          title={t("layout.resize")}
          className="flex h-6 w-6 items-center justify-center rounded-md border bg-popover text-muted-foreground shadow-sm hover:text-foreground"
        >
          <Maximize2 className="h-3 w-3" aria-hidden />
        </button>
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={t("layout.drag")}
          title={t("layout.drag")}
          className="flex h-6 w-6 cursor-grab items-center justify-center rounded-md border bg-popover text-muted-foreground shadow-sm hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <div className={cn("h-full", isDragging && "invisible")}>{children}</div>
    </div>
  );
}

const DROP_ANIMATION: DropAnimation = {
  duration: 250,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
};

/** Lifted copy of the dragged tile: bigger, tilted and with a deeper shadow. */
function LiftedTile({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className={"h-full cursor-grabbing rounded-xl"}
      initial={{ scale: 1, rotate: 0, boxShadow: "0 1px 2px rgba(0,0,0,0)" }}
      animate={{ scale: 1.03, rotate: 1, boxShadow: "0 18px 40px -8px rgba(0,0,0,0.35)" }}
      transition={{ type: "spring", bounce: 0.2, visualDuration: 0.25 }}
    >
      {children}
    </motion.div>
  );
}

/** Planner overview: hero shortcuts, today's stats, and reorderable widgets. */
export function Dashboard() {
  const { t } = useTranslation(undefined, { keyPrefix: "overview" });
  const [activeId, setActiveId] = useState<WidgetId | null>(null);
  const [layout, setLayout] = useState<DashboardLayout>(loadLayout);
  const data = useDashboardData();
  // Mounting the hook keeps the shared open-items store fresh on this screen.
  useChecklist();
  const buckets = useChecklistBuckets(data.todayStart);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const commit = useCallback((next: DashboardLayout) => {
    setLayout(next);
    saveLayout(next);
  }, []);

  const onDragStart = (event: DragStartEvent) => setActiveId(event.active.id as WidgetId);

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    commit({
      ...layout,
      order: moveWidget(layout.order, active.id as WidgetId, over.id as WidgetId),
    });
  };

  const resize = (id: WidgetId) =>
    commit({ ...layout, sizes: { ...layout.sizes, [id]: nextSize(layout.sizes[id]) } });

  const renderWidget = (id: WidgetId): ReactNode => {
    switch (id) {
      case "hero":
        return <HeroWidget data={data} openCount={buckets.open.length} />;
      case "stats":
        return (
          <StatsWidget
            data={data}
            checklistToday={buckets.today.length}
            checklistUpcoming={buckets.upcoming.length}
          />
        );
      case "habits":
        return <HabitsWidget />;
      case "calendar":
        return <MiniCalendarWidget data={data} />;
      case "checklist_today":
        return <ChecklistTodayWidget items={buckets.today} />;
      case "reminders_today":
        return <RemindersTodayWidget data={data} />;
    }
  };

  return (
    <>
      <PageContainer>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => commit(DEFAULT_LAYOUT)}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              {t("layout.reset")}
            </Button>
          }
        />
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={layout.order} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
              {layout.order.map((id) => (
                <SortableWidget key={id} id={id} size={layout.sizes[id]} onResize={() => resize(id)}>
                  {renderWidget(id)}
                </SortableWidget>
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={DROP_ANIMATION}>
            {activeId ? <LiftedTile>{renderWidget(activeId)}</LiftedTile> : null}
          </DragOverlay>
        </DndContext>
      </PageContainer>
    </>
  );
}

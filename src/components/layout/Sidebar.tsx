import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { Search } from "lucide-react";
import { NAV_BOTTOM, NAV_GROUPS } from "@/config/navigation";
import { SidebarBrand } from "@/components/layout/SidebarBrand";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip } from "@/components/ui/tooltip";
import { useHabits } from "@/hooks/useHabits";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { useChecklistStore } from "@/stores/checklistStore";
import { useUiStore } from "@/stores/uiStore";
import { selectUnseenVersion, useUpdateStore } from "@/stores/updateStore";
import { IS_MAC } from "@/utils/platform";
import { cn } from "@/utils/cn";

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand/15 px-1 text-[10px] font-semibold text-brand"
      aria-label={String(count)}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const { effectiveCollapsed } = useSidebarCollapsed();
  const openCount = useChecklistStore((s) => s.openItems.length);
  const { pendingTodayCount } = useHabits();
  const updateAvailable = useUpdateStore(selectUnseenVersion);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const modLabel = IS_MAC ? "⌘" : "Ctrl";

  const resolveBadge = (badge?: string) => {
    if (badge === "checklist-open") return openCount;
    if (badge === "habits-pending") return pendingTodayCount;
    return 0;
  };

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground motion-safe:transition-[width] motion-reduce:transition-none",
        effectiveCollapsed ? "w-[64px]" : "w-[248px]",
      )}
    >
      <div className="flex flex-col gap-3 px-2 pb-3 pt-2">
        <SidebarBrand collapsed={effectiveCollapsed} />

        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className={cn(
            "flex items-center gap-2 rounded-lg border border-sidebar-border bg-background/50 px-2.5 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
            effectiveCollapsed && "mx-auto h-10 w-10 justify-center p-0",
          )}
          aria-label={t("command_palette.open")}
        >
          <Search className={cn("shrink-0", effectiveCollapsed ? "h-5 w-5" : "h-4 w-4")} />
          {!effectiveCollapsed && (
            <>
              <span className="flex-1 truncate">{t("command_palette.search_placeholder")}</span>
              <Kbd className="hidden lg:inline-flex">{modLabel}K</Kbd>
            </>
          )}
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col">
      <ScrollArea
        className="min-h-0 flex-1"
        contentClassName={cn(
          "flex flex-col gap-4 overflow-x-hidden px-2 pb-2",
          effectiveCollapsed && "items-center gap-3",
        )}
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.headingKey ?? group.items[0]?.id ?? "group"}>
            {group.headingKey && !effectiveCollapsed && (
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t(group.headingKey)}
              </p>
            )}
            <ul className={cn("flex flex-col gap-0.5", effectiveCollapsed && "items-center gap-1")}>
              {group.items
                .filter((item) => !item.hidden)
                .map((item) => {
                  const badgeCount = resolveBadge(item.badge);
                  const label = t(item.labelKey);
                  const link = (
                    <NavLink
                      to={item.to}
                      end={item.end}
                      aria-label={label}
                      title={label}
                      className={({ isActive }) =>
                        cn(
                          "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                          effectiveCollapsed && "h-10 w-10 justify-center p-0",
                          isActive && "bg-sidebar-accent font-medium text-foreground",
                        )
                      }
                    >
                      <item.icon className={cn("shrink-0", effectiveCollapsed ? "h-5 w-5" : "h-4 w-4")} aria-hidden />
                      {!effectiveCollapsed && (
                        <>
                          <span className="truncate">{label}</span>
                          <NavBadge count={badgeCount} />
                        </>
                      )}
                      {effectiveCollapsed && badgeCount > 0 && (
                        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand" />
                      )}
                    </NavLink>
                  );
                  return (
                    <li key={item.id} className="relative">
                      {effectiveCollapsed ? (
                        <Tooltip label={label} side="right">{link}</Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </ScrollArea>
      </nav>

      <div className="mt-auto border-t border-sidebar-border px-2 py-2">
        <ul className={cn("flex flex-col gap-0.5", effectiveCollapsed && "items-center gap-1")}>
          {NAV_BOTTOM.filter((item) => !item.hidden).map((item) => {
            const label = t(item.labelKey);
            const link = (
              <NavLink
                to={item.to}
                end={item.end}
                aria-label={label}
                title={label}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                    effectiveCollapsed && "h-10 w-10 justify-center p-0",
                    isActive && "bg-sidebar-accent font-medium text-foreground",
                  )
                }
              >
                <item.icon className={cn("shrink-0", effectiveCollapsed ? "h-5 w-5" : "h-4 w-4")} aria-hidden />
                {!effectiveCollapsed && (
                  <>
                    <span className="truncate">{label}</span>
                    {item.shortcut && (
                      <Kbd className="ml-auto hidden xl:inline-flex">,</Kbd>
                    )}
                  </>
                )}
                {item.id === "about" && updateAvailable && (
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full bg-notice",
                      effectiveCollapsed ? "absolute right-1.5 top-1.5" : "ml-1",
                    )}
                    aria-label={t("update.badge")}
                    data-testid="update-badge"
                  />
                )}
              </NavLink>
            );
            return (
              <li key={item.id} className="relative">
                {effectiveCollapsed ? (
                  <Tooltip label={label} side="right">{link}</Tooltip>
                ) : (
                  link
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCommandItems, type CommandItem } from "@/components/command/commandSources";
import { matchText } from "@/components/command/matchText";
import { useUiStore } from "@/stores/uiStore";
import { cn } from "@/utils/cn";

export function CommandPalette() {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.isCommandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const allItems = useCommandItems();

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    return allItems.filter(
      (item) =>
        matchText(item.label, query) ||
        (item.keywords ? matchText(item.keywords, query) : false),
    );
  }, [allItems, query]);

  const groups = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const list = map.get(item.groupKey) ?? [];
      list.push(item);
      map.set(item.groupKey, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const flatFiltered = useMemo(
    () => groups.flatMap(([, items]) => items),
    [groups],
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveId(null);
      return;
    }
    inputRef.current?.focus();
    setActiveId(flatFiltered[0]?.id ?? null);
  }, [open, flatFiltered]);

  useEffect(() => {
    if (flatFiltered.length === 0) setActiveId(null);
    else if (!flatFiltered.some((i) => i.id === activeId)) {
      setActiveId(flatFiltered[0]?.id ?? null);
    }
  }, [flatFiltered, activeId]);

  const runActive = () => {
    const item = flatFiltered.find((i) => i.id === activeId);
    if (!item) return;
    item.onRun();
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const index = flatFiltered.findIndex((i) => i.id === activeId);
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = flatFiltered[(index + 1) % flatFiltered.length];
      if (next) setActiveId(next.id);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = flatFiltered[(index - 1 + flatFiltered.length) % flatFiltered.length];
      if (prev) setActiveId(prev.id);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveId(flatFiltered[0]?.id ?? null);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveId(flatFiltered[flatFiltered.length - 1]?.id ?? null);
    } else if (e.key === "Enter") {
      e.preventDefault();
      runActive();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4 pt-[12vh] motion-safe:animate-in motion-safe:fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("command_palette.title")}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl motion-safe:zoom-in-95"
        onKeyDown={onKeyDown}
      >
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-controls={listboxId}
          aria-activedescendant={activeId ? `${listboxId}-${activeId}` : undefined}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("command_palette.search_placeholder")}
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none"
        />
        <ScrollArea className="max-h-[min(24rem,50vh)]" contentClassName="p-2">
          {flatFiltered.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {t("command_palette.empty")}
            </p>
          )}
          {groups.map(([groupKey, items]) => (
            <div key={groupKey} className="mb-2 last:mb-0">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t(groupKey)}
              </p>
              <ul role="listbox" id={listboxId} aria-label={t(groupKey)}>
                {items.map((item) => {
                  const selected = item.id === activeId;
                  return (
                    <li key={item.id} role="presentation">
                      <button
                        type="button"
                        id={`${listboxId}-${item.id}`}
                        role="option"
                        aria-selected={selected}
                        onMouseEnter={() => setActiveId(item.id)}
                        onClick={() => {
                          setActiveId(item.id);
                          item.onRun();
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full rounded-md px-2 py-2 text-left text-sm transition-colors",
                          selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                        )}
                      >
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </ScrollArea>
      </div>
    </div>
  );
}

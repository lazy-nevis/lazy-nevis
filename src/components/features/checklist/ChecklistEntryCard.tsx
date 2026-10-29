import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUp, Calendar, Check, Clock, Flag, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { useNow } from "@/hooks/useNow";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ChecklistPriority } from "@/types";
import { startOfLocalDay } from "@/utils/dates";
import { toTone, toneStyle } from "@/utils/tones";
import { cn } from "@/utils/cn";
import { useChecklistCategories } from "./CategoryPicker";
import { EntryMenuPanel, type EntryDue, type EntryMenuView } from "./EntryMenu";
import { TagChip } from "./TagChip";
import { parseEntry, type EntryHighlightKind } from "./checklistUtils";

export interface EntryValues {
  title: string;
  tags: string[];
  category: string | null;
  priority: ChecklistPriority;
  dueDate: number | null;
  dueHasTime: boolean;
}

export interface ChecklistEntryCardProps {
  mode: "create" | "edit";
  initial?: EntryValues;
  compact?: boolean;
  /** Sub-items inherit the parent's category, so the picker is hidden for them. */
  allowCategory?: boolean;
  placeholder?: string;
  onSubmit: (values: EntryValues) => Promise<unknown> | void;
  onCancel: () => void;
}

const PRIORITY_CHIP_TEXT: Record<ChecklistPriority, string> = {
  urgent: "text-[hsl(var(--tone-rose))]",
  high: "text-[hsl(var(--tone-orange))]",
  medium: "text-[hsl(var(--tone-sky))]",
  low: "text-[hsl(var(--tone-slate))]",
  none: "",
};

const EMPTY: EntryValues = {
  title: "",
  tags: [],
  category: null,
  priority: "none",
  dueDate: null,
  dueHasTime: false,
};

function mergeTags(base: string[], extra: string[]): string[] {
  const out = [...base];
  for (const tag of extra) {
    if (!out.some((existing) => existing.toLowerCase() === tag.toLowerCase())) out.push(tag);
  }
  return out;
}

function sameDay(a: number, b: number): boolean {
  return startOfLocalDay(a) === startOfLocalDay(b);
}

/**
 * Todoist-style entry card shared by "add item" and "edit item": a borderless textarea whose
 * recognized tokens are highlighted, chips for the parsed/selected fields, and a "+" button that
 * opens a floating menu (priority, category, due date, tags).
 */
export function ChecklistEntryCard({
  mode,
  initial = EMPTY,
  compact = false,
  allowCategory = true,
  placeholder,
  onSubmit,
  onCancel,
}: ChecklistEntryCardProps) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const dateRecognition = useSettingsStore((s) => s.settings.checklist.date_recognition);
  const categories = useChecklistCategories();
  const cardRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEdit = mode === "edit";
  // WebKit doesn't focus buttons on click, so a blur caused by pressing inside the card has no relatedTarget.
  const pressingInside = useRef(false);

  const [text, setText] = useState(initial.title);
  const [baseTags, setBaseTags] = useState(initial.tags);
  const [categoryChoice, setCategoryChoice] = useState<string | null>(initial.category);
  const [priorityChoice, setPriorityChoice] = useState<ChecklistPriority>(initial.priority);
  const [manualDue, setManualDue] = useState<EntryDue | null>(
    initial.dueDate === null ? null : { ms: initial.dueDate, hasTime: initial.dueHasTime },
  );
  // Edit mode starts with the existing title's date-like text left alone (it was kept on purpose).
  const [rejectDate, setRejectDate] = useState(isEdit);
  const [dropTime, setDropTime] = useState(false);
  const [busy, setBusy] = useState(false);

  const parseOptions = { now, locale: i18n.language, dateRecognition };
  const baselineDue = useMemo(
    () => (isEdit ? (parseEntry(initial.title, parseOptions).due?.ms ?? null) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const parsed = parseEntry(text, { ...parseOptions, rejectDate });

  const category = allowCategory ? (parsed.category ?? categoryChoice) : null;
  const priority = parsed.priority !== "none" ? parsed.priority : priorityChoice;
  const tags = mergeTags(baseTags, parsed.tags);
  let due: EntryDue | null = parsed.due ?? manualDue;
  if (due && dropTime) due = { ms: startOfLocalDay(due.ms), hasTime: false };

  const categoryRecord = category
    ? categories.find((cat) => cat.name.toLowerCase() === category.toLowerCase())
    : undefined;

  const canSubmit = parsed.title.length > 0 && !busy;

  const stripKinds = (kinds: EntryHighlightKind[], only?: (span: string) => boolean) => {
    const spans = parsed.highlights
      .filter((h) => kinds.includes(h.kind) && (!only || only(text.slice(h.start, h.end))))
      .sort((a, b) => b.start - a.start);
    if (spans.length === 0) return;
    let next = text;
    for (const span of spans) next = next.slice(0, span.start) + next.slice(span.end);
    setText(next.replace(/[ \t]{2,}/g, " ").trimStart());
  };

  const reset = () => {
    setText("");
    setBaseTags([]);
    setCategoryChoice(null);
    setPriorityChoice("none");
    setManualDue(null);
    setRejectDate(false);
    setDropTime(false);
  };

  const submit = async () => {
    if (!canSubmit) return;
    const values: EntryValues = {
      title: parsed.title,
      tags,
      category,
      priority,
      dueDate: due?.ms ?? null,
      dueHasTime: due?.hasTime ?? false,
    };
    setBusy(true);
    try {
      if (!isEdit) reset();
      await onSubmit(values);
    } finally {
      setBusy(false);
      if (!isEdit) textareaRef.current?.focus();
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (el && isEdit) el.setSelectionRange(el.value.length, el.value.length);
  }, [isEdit]);

  // An abandoned empty "add" card disappears when the user clicks elsewhere (popovers don't count).
  useEffect(() => {
    if (isEdit) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || cardRef.current?.contains(target) || target.closest("[role='dialog']")) return;
      if (!textareaRef.current?.value.trim()) onCancel();
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [isEdit, onCancel]);

  const onChange = (value: string) => {
    setText(value);
    setDropTime(false);
    if (!isEdit) {
      setRejectDate(false);
      return;
    }
    const next = parseEntry(value, { ...parseOptions, rejectDate: false }).due?.ms ?? null;
    setRejectDate(next === baselineDue);
  };

  const backdrop = (() => {
    const parts: ReactNode[] = [];
    let cursor = 0;
    const sorted = [...parsed.highlights].sort((a, b) => a.start - b.start);
    for (const highlight of sorted) {
      if (highlight.start < cursor) continue;
      if (highlight.start > cursor) parts.push(text.slice(cursor, highlight.start));
      parts.push(
        <span
          key={highlight.start}
          className={cn(
            "rounded-[3px] box-decoration-clone",
            highlight.kind === "date"
              ? "bg-primary/45 text-foreground"
              : "bg-primary/15 text-primary",
          )}
        >
          {text.slice(highlight.start, highlight.end)}
        </span>,
      );
      cursor = highlight.end;
    }
    parts.push(text.slice(cursor));
    return parts;
  })();

  const refocusText = () => requestAnimationFrame(() => textareaRef.current?.focus());

  const panel = (view: EntryMenuView) => {
    const Panel = (close: () => void) => (
      <EntryMenuPanel
        initialView={view}
        close={() => {
          close();
          refocusText();
        }}
        categories={categories}
        allowCategory={allowCategory}
        category={category}
        onCategory={(name) => {
          stripKinds(["category"]);
          setCategoryChoice(name);
        }}
        priority={priority}
        onPriority={(next) => {
          stripKinds(["priority"]);
          setPriorityChoice(next);
        }}
        due={due}
        onDue={(next) => {
          stripKinds(["date"]);
          setRejectDate(false);
          setDropTime(false);
          setManualDue(next);
        }}
        onAddTag={(name) => setBaseTags((current) => mergeTags(current, [name]))}
      />
    );
    return Panel;
  };

  const chipTrigger = cn(
    "h-6 gap-1 rounded-md border-border bg-transparent px-2 text-xs font-normal",
    compact && "h-5 px-1.5 text-[11px]",
  );
  const iconSize = compact ? "h-3 w-3" : "h-3.5 w-3.5";

  const removeButton = (label: string, onRemove: () => void) => (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onRemove();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onRemove();
        }
      }}
      className="-mr-0.5 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <X className="h-3 w-3" />
    </span>
  );

  const dateLabel = due
    ? new Intl.DateTimeFormat(i18n.language, {
        day: "numeric",
        month: "short",
        ...(sameDay(due.ms, now) || new Date(due.ms).getFullYear() === new Date(now).getFullYear()
          ? {}
          : { year: "numeric" }),
      }).format(new Date(due.ms))
    : "";
  const timeLabel =
    due?.hasTime
      ? new Intl.DateTimeFormat(i18n.language, { hour: "numeric", minute: "2-digit" }).format(new Date(due.ms))
      : "";

  const hasChips = Boolean(category || due || priority !== "none" || tags.length > 0);

  const textMetrics = cn(
    "col-start-1 row-start-1 w-full whitespace-pre-wrap break-words font-sans",
    compact ? "text-xs leading-5" : "text-sm leading-6",
  );

  return (
    <div
      ref={cardRef}
      data-testid="checklist-entry-card"
      onMouseDown={() => {
        pressingInside.current = true;
        window.setTimeout(() => (pressingInside.current = false), 0);
      }}
      className={cn(
        "rounded-xl border border-border bg-card/70 shadow-sm transition-colors focus-within:border-primary/50",
        compact ? "px-2.5 pb-1.5 pt-2" : "px-3 pb-2 pt-3",
      )}
    >
      <div className="grid">
        <div aria-hidden className={cn(textMetrics, "pointer-events-none text-foreground")}>
          {backdrop}
          {"​"}
        </div>
        <textarea
          ref={textareaRef}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          rows={1}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              if (parsed.due && !rejectDate) setRejectDate(true);
              else onCancel();
            }
          }}
          onBlur={(e) => {
            // An abandoned empty "add" line collapses (spec: daily-checklist/abandoned-empty-line).
            if (isEdit || e.currentTarget.value.trim() || pressingInside.current) return;
            if (cardRef.current?.contains(e.relatedTarget as Node | null)) return;
            onCancel();
          }}
          placeholder={placeholder ?? t("checklist.add_placeholder")}
          aria-label={placeholder ?? t("checklist.add_placeholder")}
          className={cn(
            textMetrics,
            "resize-none overflow-hidden bg-transparent p-0 text-transparent caret-foreground outline-none placeholder:text-muted-foreground",
          )}
        />
      </div>

      {hasChips && (
        <div className={cn("flex flex-wrap items-center gap-1.5", compact ? "mt-1.5" : "mt-2")}>
          {category && allowCategory && (
            <Popover
              ariaLabel={t("checklist.category.label")}
              triggerClassName={chipTrigger}
              className="p-1.5"
              trigger={
                <>
                  <span
                    className={cn("h-2 w-2 shrink-0 rounded-full", categoryRecord ? "tone-dot" : "bg-muted-foreground/60")}
                    style={categoryRecord ? toneStyle(toTone(categoryRecord.tone)) : undefined}
                    aria-hidden
                  />
                  <span className="max-w-28 truncate">{category}</span>
                  {removeButton(t("checklist.entry.remove_category"), () => {
                    stripKinds(["category"]);
                    setCategoryChoice(null);
                  })}
                </>
              }
            >
              {panel("category")}
            </Popover>
          )}
          {due && (
            <Popover
              ariaLabel={t("checklist.entry.due")}
              triggerClassName={cn(chipTrigger, "border-primary/40 text-primary")}
              className="p-2"
              trigger={
                <>
                  <Calendar className={iconSize} aria-hidden />
                  <span>{dateLabel}</span>
                  {removeButton(t("checklist.reject_date"), () => {
                    setRejectDate(true);
                    setManualDue(null);
                  })}
                </>
              }
            >
              {panel("due")}
            </Popover>
          )}
          {due?.hasTime && (
            <Popover
              ariaLabel={t("checklist.entry.time")}
              triggerClassName={cn(chipTrigger, "border-primary/40 text-primary")}
              className="p-2"
              trigger={
                <>
                  <Clock className={iconSize} aria-hidden />
                  <span className="tabular-nums">{timeLabel}</span>
                  {removeButton(t("checklist.entry.remove_time"), () => {
                    if (parsed.due) setDropTime(true);
                    else setManualDue({ ms: startOfLocalDay(due.ms), hasTime: false });
                  })}
                </>
              }
            >
              {panel("due")}
            </Popover>
          )}
          {priority !== "none" && (
            <Popover
              ariaLabel={t("checklist.priority.label")}
              triggerClassName={cn(chipTrigger, PRIORITY_CHIP_TEXT[priority])}
              className="p-1.5"
              trigger={
                <>
                  <Flag className={iconSize} aria-hidden />
                  <span>{t(`checklist.priority.${priority}`)}</span>
                  {removeButton(t("checklist.entry.remove_priority"), () => {
                    stripKinds(["priority"]);
                    setPriorityChoice("none");
                  })}
                </>
              }
            >
              {panel("priority")}
            </Popover>
          )}
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-0.5">
              <TagChip name={tag} />
              {removeButton(t("checklist.remove_tag", { tag }), () => {
                setBaseTags((current) => current.filter((existing) => existing.toLowerCase() !== tag.toLowerCase()));
                stripKinds(["tag"], (span) => span.slice(1).toLowerCase() === tag.toLowerCase());
              })}
            </span>
          ))}
        </div>
      )}

      {!parsed.title && text.trim() && (
        <p className="mt-1.5 text-xs text-destructive">{t("checklist.empty_title_hint")}</p>
      )}

      <div className={cn("flex items-center justify-between gap-2", compact ? "mt-1.5" : "mt-2.5")}>
        <Popover
          ariaLabel={t("checklist.entry.more")}
          triggerClassName={cn(
            "h-7 w-7 justify-center rounded-md border-transparent bg-transparent px-0 text-muted-foreground hover:text-foreground",
            compact && "h-6 w-6",
          )}
          className="p-1.5"
          trigger={<Plus className="h-4 w-4" aria-hidden />}
        >
          {panel("menu")}
        </Popover>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onCancel}
            aria-label={t("common.cancel")}
            className={cn(compact && "h-6 px-1.5")}
          >
            {compact ? <X className="h-3.5 w-3.5" /> : t("common.cancel")}
          </Button>
          <Button
            type="button"
            size="xs"
            disabled={!canSubmit}
            onClick={() => void submit()}
            aria-label={isEdit ? t("common.save") : t("checklist.entry.add")}
            className={cn(compact && "h-6 px-2")}
          >
            {isEdit ? (
              compact ? <Check className="h-3.5 w-3.5" /> : t("common.save")
            ) : compact ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              t("checklist.entry.add")
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

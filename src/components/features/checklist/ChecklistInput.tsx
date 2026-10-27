import { useRef, useState } from "react";
import { Calendar, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { parseEntry } from "./checklistUtils";
import type { CreateChecklistInput } from "@/types";
import { useSettingsStore } from "@/stores/settingsStore";
import { useNow } from "@/hooks/useNow";
import { formatDate, formatDateTime } from "@/utils/formatters";
import { cn } from "@/utils/cn";

interface Props {
  onCreate: (input: CreateChecklistInput) => Promise<unknown>;
  autoFocus?: boolean;
  parentId?: string;
  compact?: boolean;
}

export function ChecklistInput({ onCreate, autoFocus = false, parentId, compact = false }: Props) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const dateRecognition = useSettingsStore((s) => s.settings.checklist.date_recognition);
  const [editing, setEditing] = useState(autoFocus);
  const [value, setValue] = useState("");
  const [rejectDate, setRejectDate] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = parseEntry(value, {
    now,
    locale: i18n.language,
    dateRecognition,
    rejectDate,
  });

  const submit = async () => {
    if (!parsed.title) return;
    setValue("");
    setRejectDate(false);
    try {
      await onCreate({
        title: parsed.title,
        tags: parsed.tags,
        dueDate: parsed.due?.ms ?? null,
        dueHasTime: parsed.due?.hasTime ?? false,
        category: parsed.category,
        priority: parsed.priority,
        parentId: parentId ?? null,
      });
    } finally {
      inputRef.current?.focus();
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground",
          compact && "px-2 py-1.5 text-xs",
          parentId && "ml-6",
        )}
      >
        <Plus className="h-4 w-4" />
        {parentId ? t("checklist.add_sub_item") : t("checklist.add_item")}
      </button>
    );
  }

  const backdrop = (() => {
    if (!value) return null;
    const parts: { text: string; kind?: string }[] = [];
    const sorted = [...parsed.highlights].sort((a, b) => a.start - b.start);
    let cursor = 0;
    for (const highlight of sorted) {
      if (highlight.start > cursor) {
        parts.push({ text: value.slice(cursor, highlight.start) });
      }
      parts.push({ text: value.slice(highlight.start, highlight.end), kind: highlight.kind });
      cursor = highlight.end;
    }
    if (cursor < value.length) parts.push({ text: value.slice(cursor) });
    return parts.map((part, index) => {
      const highlighted = part.kind === "date";
      return (
        <span
          key={index}
          className={highlighted ? "rounded-sm bg-muted/60 text-foreground" : undefined}
        >
          {part.text}
        </span>
      );
    });
  })();

  return (
    <div className={cn("relative space-y-1", parentId && "ml-6")}>
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words px-3 py-2 text-sm text-foreground"
        >
          {backdrop}
        </div>
        <input
          ref={inputRef}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setRejectDate(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            } else if (e.key === "Escape") {
              if (parsed.due && !rejectDate) {
                setRejectDate(true);
              } else {
                setValue("");
                setEditing(false);
              }
            }
          }}
          onBlur={() => {
            if (!value.trim()) setEditing(false);
          }}
          placeholder={t("checklist.add_placeholder")}
          className="relative w-full rounded-md border bg-transparent px-3 py-2 text-sm text-transparent caret-foreground outline-none transition-colors focus:border-primary"
        />
      </div>
      {parsed.due && !rejectDate && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {parsed.due.hasTime
              ? formatDateTime(parsed.due.ms, i18n.language)
              : formatDate(parsed.due.ms, i18n.language)}
          </span>
          <button
            type="button"
            onClick={() => setRejectDate(true)}
            className="rounded p-0.5 hover:bg-accent"
            aria-label={t("checklist.reject_date")}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {!parsed.title && value.trim() && (
        <p className="text-xs text-destructive">{t("checklist.empty_title_hint")}</p>
      )}
    </div>
  );
}

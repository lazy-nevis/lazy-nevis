import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bold, Italic, List, ListOrdered, type LucideIcon } from "lucide-react";
import { MarkdownView } from "@/components/features/reminders/MarkdownView";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/utils/cn";
import { applyMarkdownFormat, type MarkdownFormat } from "@/components/features/reminders/markdownFormat";

const TOOLS: Array<{ format: MarkdownFormat; icon: LucideIcon }> = [
  { format: "bold", icon: Bold },
  { format: "italic", icon: Italic },
  { format: "bullet", icon: List },
  { format: "numbered", icon: ListOrdered },
];

/** Textarea with a small formatting toolbar and a write/preview toggle. */
export function MarkdownEditor({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "reminders.editor" });
  const [preview, setPreview] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const apply = (format: MarkdownFormat) => {
    const el = ref.current;
    if (!el) return;
    const result = applyMarkdownFormat(value, el.selectionStart, el.selectionEnd, format);
    onChange(result.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-input focus-within:ring-2 focus-within:ring-ring">
      <div className="flex items-center gap-0.5 border-b border-border bg-muted/40 px-1.5 py-1">
        {TOOLS.map(({ format, icon: Icon }) => (
          <Tooltip key={format} label={t(`format.${format}`)}>
            <button
              type="button"
              aria-label={t(`format.${format}`)}
              disabled={preview}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => apply(format)}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              <Icon className="h-4 w-4" aria-hidden />
            </button>
          </Tooltip>
        ))}
        <div className="ml-auto inline-flex rounded-md bg-background/60 p-0.5 text-xs">
          {([false, true] as const).map((mode) => (
            <button
              key={String(mode)}
              type="button"
              aria-pressed={preview === mode}
              onClick={() => setPreview(mode)}
              className={cn(
                "rounded px-2 py-0.5 font-medium",
                preview === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {mode ? t("preview") : t("write")}
            </button>
          ))}
        </div>
      </div>
      {preview ? (
        <MarkdownView
          content={value || "—"}
          className="prose prose-sm min-h-28 max-w-none px-3 py-2 dark:prose-invert"
        />
      ) : (
        <textarea
          ref={ref}
          aria-label={label}
          className="block min-h-28 w-full resize-y bg-background px-3 py-2 text-sm focus:outline-none"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (!(event.metaKey || event.ctrlKey)) return;
            const key = event.key.toLowerCase();
            if (key === "b" || key === "i") {
              event.preventDefault();
              apply(key === "b" ? "bold" : "italic");
            }
          }}
        />
      )}
    </div>
  );
}

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { parseInlineTags } from "./checklistUtils";

interface Props {
  onCreate: (title: string, tags: string[]) => Promise<unknown>;
  autoFocus?: boolean;
}

/**
 * Notepad-style entry line: Enter creates the item and keeps the line focused
 * for the next one; blurring an empty line collapses it back to the add row.
 * Spec: daily-checklist/rapid-entry + abandoned-empty-line.
 */
export function ChecklistInput({ onCreate, autoFocus = false }: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(autoFocus);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const { title, tags } = parseInlineTags(value);
    if (!title) return;
    setValue("");
    try {
      await onCreate(title, tags);
    } finally {
      inputRef.current?.focus();
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex w-full items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        {t("checklist.add_item")}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void submit();
        } else if (e.key === "Escape") {
          setValue("");
          setEditing(false);
        }
      }}
      onBlur={() => {
        // Empty line loses focus → the line disappears.
        if (!value.trim()) setEditing(false);
      }}
      placeholder={t("checklist.add_placeholder")}
      className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
    />
  );
}

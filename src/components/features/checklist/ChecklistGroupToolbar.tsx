import type { ChecklistView } from "@/hooks/useChecklistView";
import { ChecklistSettingsButton } from "./ChecklistSettingsButton";
import { ChecklistViewControls } from "./ChecklistViewControls";

/** Full-width toolbar for the Checklist page; compact/tray use `ChecklistViewMenu` instead. */
export function ChecklistGroupToolbar({ view }: { view: ChecklistView }) {
  return (
    <div className="mb-3 flex items-start gap-2">
      <ChecklistViewControls view={view} className="min-w-0 flex-1" />
      <ChecklistSettingsButton />
    </div>
  );
}

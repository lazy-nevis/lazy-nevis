import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checklistService } from "@/services/tauri";
import type { ChecklistItem, SessionLifecyclePayload } from "@/types";

/**
 * Watches `session:stopped` and, when the session was started from a
 * still-open checklist item, asks whether to complete it. Mounted once in the
 * main window's AppShell — never automatic.
 * Spec: focus-sessions/prompt-on-stop + daily-checklist/stop-prompts-completion.
 */
export function LinkedItemPrompt() {
  const { t } = useTranslation();
  const [item, setItem] = useState<ChecklistItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    listen<SessionLifecyclePayload>("session:stopped", async (ev) => {
      const linked = await checklistService
        .getLinkedItem(ev.payload.session_id)
        .catch(() => null);
      if (linked) setItem(linked);
    }).then((un) => {
      if (cancelled) un();
      else unlisten = un;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return (
    <Dialog open={item !== null} onClose={() => setItem(null)}>
      <DialogHeader>
        <DialogTitle>{t("checklist.linked_prompt_title")}</DialogTitle>
      </DialogHeader>
      <p className="px-6 pb-2 text-sm text-muted-foreground">
        {t("checklist.linked_prompt_body", { title: item?.title ?? "" })}
      </p>
      <DialogFooter>
        <Button variant="outline" onClick={() => setItem(null)}>
          {t("checklist.linked_prompt_keep")}
        </Button>
        <Button
          variant="success"
          onClick={() => {
            if (item) void checklistService.complete(item.id).catch(() => {});
            setItem(null);
          }}
        >
          {t("checklist.linked_prompt_complete")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

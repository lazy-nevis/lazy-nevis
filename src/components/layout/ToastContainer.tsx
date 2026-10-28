import { useUiStore } from "@/stores/uiStore";
import { cn } from "@/utils/cn";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

export function ToastContainer() {
  const { toasts, removeToast } = useUiStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-center gap-3 rounded-xl border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg",
            "animate-in slide-in-from-right-5 duration-200",
            toast.type === "success" && "border-success/30",
            toast.type === "error" && "border-destructive/40",
          )}
        >
          {toast.type === "success" && <CheckCircle className="h-4 w-4 shrink-0 text-success" />}
          {toast.type === "error" && <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
          {toast.type === "info" && <Info className="h-4 w-4 shrink-0" />}
          <span>{toast.message}</span>
          <button onClick={() => removeToast(toast.id)} className="ml-auto opacity-60 hover:opacity-100">
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

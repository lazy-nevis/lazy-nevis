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
            "flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg text-sm",
            "animate-in slide-in-from-right-5 duration-200",
            toast.type === "success" && "bg-green-50 border-green-200 text-green-900 dark:bg-green-950 dark:border-green-800 dark:text-green-100",
            toast.type === "error" && "bg-red-50 border-red-200 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-100",
            toast.type === "info" && "bg-background border text-foreground"
          )}
        >
          {toast.type === "success" && <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />}
          {toast.type === "error" && <XCircle className="h-4 w-4 shrink-0 text-red-600" />}
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

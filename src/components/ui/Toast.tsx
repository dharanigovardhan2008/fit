import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "../../utils/cn";

interface ToastItem {
  id: number;
  message: string;
  kind: "success" | "error";
}

interface ToastContextValue {
  notify: (message: string, kind?: "success" | "error") => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const notify = useCallback((message: string, kind: "success" | "error" = "success") => {
    const id = ++toastId;
    setItems((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:top-6">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-on-ink shadow-dark-button animate-fade-in",
            )}
          >
            {item.kind === "success" ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <p className="text-sm leading-5">{item.message}</p>
            <button
              type="button"
              aria-label="Dismiss notification"
              className="ml-auto shrink-0 opacity-70 hover:opacity-100"
              onClick={() => setItems((prev) => prev.filter((t) => t.id !== item.id))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

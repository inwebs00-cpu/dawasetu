"use client";

import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: "default" | "success" | "error";
}

interface ToastMessage extends ToastInput {
  id: number;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function Toast({
  title,
  description,
  variant = "default",
  onDismiss,
}: ToastInput & { onDismiss: () => void }) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex w-full items-start justify-between gap-4 rounded-xl border bg-white p-4 shadow-lg",
        variant === "success" && "border-emerald-200",
        variant === "error" && "border-rose-200",
        variant === "default" && "border-slate-200",
      )}
    >
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {description && (
          <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
        )}
      </div>
      <Button
        aria-label="Dismiss notification"
        size="icon"
        variant="ghost"
        onClick={onDismiss}
      >
        <X aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const sequence = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++sequence.current;
      setMessages((current) => [...current, { ...input, id }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), 5000),
      );
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed inset-x-4 bottom-4 z-50 ml-auto flex max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        {messages.map((message) => (
          <Toast
            key={message.id}
            {...message}
            onDismiss={() => dismiss(message.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider.");
  return context;
}

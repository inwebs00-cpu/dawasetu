"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="dawasetu-dialog m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onClose={() => onOpenChange(false)}
    >
      <div className={cn("p-6", className)}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="mt-1 text-sm leading-6 text-slate-600"
              >
                {description}
              </p>
            )}
          </div>
          <Button
            aria-label="Close dialog"
            size="icon"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </dialog>
  );
}

export { Dialog as Modal };

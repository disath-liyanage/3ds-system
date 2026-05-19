"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
  className?: string;
  contentClassName?: string;
  hideFooterClose?: boolean;
  showTopClose?: boolean;
};

export function Dialog({
  open,
  title,
  description,
  children,
  onOpenChange,
  className,
  contentClassName,
  hideFooterClose = false,
  showTopClose = false
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={cn("w-full max-w-md rounded-xl border border-border bg-white p-0 shadow-xl backdrop:bg-black/35", className)}
      onClose={() => onOpenChange(false)}
    >
      <div className={cn("max-h-[85vh] overflow-y-auto p-6", contentClassName)}>
        {showTopClose ? (
          <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-4 flex items-start justify-between bg-white/75 px-6 py-4 backdrop-blur-sm">
            <div className="space-y-1 pr-4">
              <h2 className="text-lg font-semibold">{title}</h2>
              {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-white/85 text-muted-foreground shadow-sm transition hover:bg-white hover:text-foreground"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{title}</h2>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
        )}
        {children}
        {hideFooterClose ? null : (
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        )}
      </div>
    </dialog>
  );
}

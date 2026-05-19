"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

type DialogProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
  maxWidthClassName?: string;
  bodyClassName?: string;
  showBottomClose?: boolean;
  stickyHeader?: boolean;
};

export function Dialog({
  open,
  title,
  description,
  children,
  onOpenChange,
  maxWidthClassName = "max-w-md",
  bodyClassName,
  showBottomClose = true,
  stickyHeader = false
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
      className={`w-full ${maxWidthClassName} rounded-xl border border-border bg-white p-0 shadow-xl backdrop:bg-black/35`}
      onClose={() => onOpenChange(false)}
    >
      <div className={`relative ${stickyHeader ? "max-h-[85vh] overflow-hidden" : ""}`}>
        <button
          type="button"
          aria-label="Close dialog"
          onClick={() => onOpenChange(false)}
          className={`absolute right-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-white/80 text-muted-foreground shadow-sm backdrop-blur-sm transition hover:text-foreground ${
            stickyHeader ? "top-4" : "top-6"
          }`}
        >
          <X className="h-4 w-4" />
        </button>
        <div className={`space-y-4 p-6 ${stickyHeader ? "sticky top-0 z-10 border-b border-border bg-white/95 pr-16 backdrop-blur-sm" : "pr-16"}`}>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{title}</h2>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        <div className={`${stickyHeader ? "max-h-[calc(85vh-104px)] overflow-y-auto p-6 pt-4" : "p-6 pt-0"} ${bodyClassName ?? ""}`}>
          {children}
          {showBottomClose ? (
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}

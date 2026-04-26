"use client";

import { useEffect, useState } from "react";

import { APP_TOAST_EVENT, type ToastPayload, type ToastVariant } from "@/lib/toast";

type ToastItem = ToastPayload & {
  id: number;
};

const variantClassNames: Record<ToastVariant, string> = {
  success: "border-green-300 bg-green-50 text-green-800",
  error: "border-red-300 bg-red-50 text-red-800",
  info: "border-slate-300 bg-white text-slate-800"
};

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function onToast(event: Event) {
      const customEvent = event as CustomEvent<ToastPayload>;
      const payload = customEvent.detail;
      if (!payload?.title) return;

      const item: ToastItem = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        title: payload.title,
        description: payload.description,
        variant: payload.variant || "info"
      };

      setToasts((prev) => [...prev, item]);

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== item.id));
      }, 3500);
    }

    window.addEventListener(APP_TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(APP_TOAST_EVENT, onToast);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-end p-4" aria-live="polite">
      <div className="w-full max-w-sm space-y-2">
        {toasts.map((toast) => {
          const variant: ToastVariant = toast.variant || "info";

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-md border px-4 py-3 text-sm shadow ${variantClassNames[variant]}`}
            >
              <p className="font-semibold">{toast.title}</p>
              {toast.description ? <p className="mt-1 text-xs opacity-90">{toast.description}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
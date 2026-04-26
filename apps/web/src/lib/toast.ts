export type ToastVariant = "success" | "error" | "info";

export type ToastPayload = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

export const APP_TOAST_EVENT = "paintdist:toast";

export function toast(payload: ToastPayload) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<ToastPayload>(APP_TOAST_EVENT, {
      detail: payload
    })
  );
}

export type ToastKind = "info" | "success" | "error";

export type ToastEventDetail = {
  kind: ToastKind;
  message: string;
  durationMs?: number;
};

const EVENT_NAME = "acemock:toast";

export function toast(detail: ToastEventDetail) {
  try {
    window.dispatchEvent(new CustomEvent<ToastEventDetail>(EVENT_NAME, { detail }));
  } catch {
    // no-op (SSR / unsupported env)
  }
}

export function toastError(message: string, durationMs?: number) {
  toast({ kind: "error", message, durationMs });
}

export function toastInfo(message: string, durationMs?: number) {
  toast({ kind: "info", message, durationMs });
}

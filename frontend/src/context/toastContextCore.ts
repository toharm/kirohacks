import { createContext } from "react";

export type ToastTone = "success" | "warning" | "critical" | "info";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  message?: string;
}

export interface ToastContextValue {
  toasts: Toast[];
  pushToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

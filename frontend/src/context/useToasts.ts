import { useContext } from "react";
import { ToastContext } from "./toastContextCore";

export function useToasts() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToasts must be used inside ToastProvider");
  }

  return context;
}

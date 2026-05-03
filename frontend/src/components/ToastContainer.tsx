import { useToasts } from "../context/useToasts";

export function ToastContainer() {
  const { toasts, removeToast } = useToasts();

  return (
    <div className="toast-stack" aria-live="polite" aria-label="System notifications">
      {toasts.map((toast) => (
        <article className={`toast toast--${toast.tone}`} key={toast.id}>
          <div>
            <strong>{toast.title}</strong>
            {toast.message ? <p>{toast.message}</p> : null}
          </div>
          <button
            className="icon-button icon-button--small"
            type="button"
            aria-label={`Dismiss ${toast.title}`}
            onClick={() => removeToast(toast.id)}
          >
            x
          </button>
        </article>
      ))}
    </div>
  );
}

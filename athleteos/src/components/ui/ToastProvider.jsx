import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { ToastContext } from "../../context/toastContextValue";
import "./toast.css";

const MAX_VISIBLE_TOASTS = 3;
const DEFAULT_TITLES = {
  success: "C’est fait",
  error: "Action impossible",
  warning: "À vérifier",
  info: "Information",
};
const DEFAULT_DURATIONS = {
  success: 4_000,
  error: 0,
  warning: 6_000,
  info: 5_000,
};
const TOAST_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

let nextToastId = 0;

function normalizeToast(tone, input) {
  const options = typeof input === "string" ? { message: input } : (input ?? {});
  const title = options.title ?? DEFAULT_TITLES[tone];
  const message = options.message ?? "";

  return {
    ...options,
    tone,
    title,
    message,
    duration: options.duration ?? DEFAULT_DURATIONS[tone],
    dedupeKey: options.key ?? `${tone}:${title}:${message}`,
  };
}

function ToastItem({ toast, onDismiss }) {
  const Icon = TOAST_ICONS[toast.tone] ?? Info;

  useEffect(() => {
    if (!toast.duration) return undefined;
    const timeout = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, toast.duration, toast.id, toast.revision]);

  const handleAction = () => {
    toast.action?.onClick?.();
    onDismiss(toast.id);
  };

  return (
    <div
      className={`aos-toast aos-toast--${toast.tone}`}
      role={toast.tone === "error" ? "alert" : "status"}
      aria-atomic="true"
      data-toast-key={toast.dedupeKey}
    >
      <span className="aos-toast__icon" aria-hidden="true">
        <Icon size={20} strokeWidth={2.2} />
      </span>

      <div className="aos-toast__content">
        <div className="aos-toast__heading">
          <p className="aos-toast__title">{toast.title}</p>
          {toast.occurrences > 1 && (
            <span className="aos-toast__count" aria-label={`Répété ${toast.occurrences} fois`}>
              ×{toast.occurrences}
            </span>
          )}
        </div>
        {toast.message && <p className="aos-toast__message">{toast.message}</p>}
        {toast.action?.label && (
          <button type="button" className="aos-toast__action" onClick={handleAction}>
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        className="aos-toast__close"
        aria-label="Fermer la notification"
        onClick={() => onDismiss(toast.id)}
      >
        <X size={18} aria-hidden="true" />
      </button>

      {toast.duration > 0 && (
        <span
          key={toast.revision}
          className="aos-toast__timer"
          aria-hidden="true"
          style={{ "--toast-duration": `${toast.duration}ms` }}
        />
      )}
    </div>
  );
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((toastId) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const clear = useCallback(() => setToasts([]), []);

  const show = useCallback((tone, input) => {
    const normalized = normalizeToast(tone, input);
    const proposedId = `toast-${++nextToastId}`;

    setToasts((current) => {
      const duplicate = current.find((toast) => toast.dedupeKey === normalized.dedupeKey);
      if (duplicate) {
        return current.map((toast) => toast.id === duplicate.id ? {
          ...toast,
          ...normalized,
          id: duplicate.id,
          occurrences: toast.occurrences + 1,
          revision: toast.revision + 1,
        } : toast);
      }

      return [...current, {
        ...normalized,
        id: proposedId,
        occurrences: 1,
        revision: 0,
      }];
    });

    return proposedId;
  }, []);

  const api = useMemo(() => ({
    show,
    success: (input) => show("success", input),
    error: (input) => show("error", input),
    warning: (input) => show("warning", input),
    info: (input) => show("info", input),
    dismiss,
    clear,
  }), [clear, dismiss, show]);

  const visibleToasts = toasts.slice(0, MAX_VISIBLE_TOASTS);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="aos-toast-viewport" aria-label="Notifications">
        {visibleToasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

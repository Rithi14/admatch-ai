import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

/** Fixed notification stack. Rendered once by <ToastProvider>. */
export default function Toaster({ toasts, onDismiss }) {
  return (
    <div className="toaster" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => {
        const Icon = ICONS[t.tone] || Info;
        return (
          <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <Icon size={19} className="toast-icon" aria-hidden="true" />
            <div className="toast-body">
              <strong>{t.title}</strong>
              {t.message && <p>{t.message}</p>}
            </div>
            <button type="button" className="icon-btn toast-close" onClick={() => onDismiss(t.id)} aria-label="Dismiss notification">
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

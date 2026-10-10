import { AlertCircle, AlertTriangle, Info, RotateCcw, X } from 'lucide-react';

const ICONS = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

/**
 * Reusable alert box.
 * variant: 'error' (default) | 'warning' | 'info'
 */
export default function ErrorMessage({
  title,
  message,
  variant = 'error',
  onRetry,
  retryLabel = 'Try again',
  onDismiss,
  children,
}) {
  const Icon = ICONS[variant] || AlertCircle;
  const heading =
    title || (variant === 'error' ? 'Something went wrong' : variant === 'warning' ? 'Heads up' : 'Note');

  return (
    <div className={`alert alert-${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
      <Icon className="alert-icon" size={20} aria-hidden="true" />
      <div className="alert-body">
        <strong>{heading}</strong>
        {message && <p>{message}</p>}
        {children}
        {onRetry && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
            <RotateCcw size={14} aria-hidden="true" /> {retryLabel}
          </button>
        )}
      </div>
      {onDismiss && (
        <button type="button" className="icon-btn alert-close" onClick={onDismiss} aria-label="Dismiss message">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

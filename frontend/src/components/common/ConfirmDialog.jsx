import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Accessible confirmation modal built on the native <dialog> element
 * (focus trap, Escape to cancel and inert background come from the browser).
 */
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
      cancelRef.current?.focus();
    } else if (typeof dialog.close === 'function') {
      if (dialog.open) dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      onCancel={(event) => {
        event.preventDefault();
        onCancel?.();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onCancel?.();
      }}
    >
      {open && (
        <div className="confirm-body" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
          <div className={`confirm-icon tone-${tone}`}>
            <AlertTriangle size={22} aria-hidden="true" />
          </div>
          <h2 id="confirm-title">{title}</h2>
          <p id="confirm-message" className="muted">
            {message}
          </p>
          <div className="confirm-actions">
            <button type="button" ref={cancelRef} className="btn btn-secondary" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button type="button" className={`btn ${tone === 'danger' ? 'btn-danger-solid' : 'btn-primary'}`} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

import { Check, Copy } from 'lucide-react';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

/** Button that copies `text` and briefly confirms. */
export default function CopyButton({ text, label = 'Copy', copiedLabel = 'Copied', className = 'btn btn-secondary btn-sm', ariaLabel }) {
  const { copied, error, copy } = useCopyToClipboard();
  return (
    <button type="button" className={className} onClick={() => copy(text)} aria-label={ariaLabel}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span aria-live="polite">{copied ? copiedLabel : error ? 'Copy failed' : label}</span>
    </button>
  );
}

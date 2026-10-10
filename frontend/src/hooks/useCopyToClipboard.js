import { useCallback, useEffect, useRef, useState } from 'react';

/** Copies text to the clipboard (with a textarea fallback) and reports a short-lived "copied" flag. */
export function useCopyToClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text) => {
      let ok = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          ok = true;
        }
      } catch {
        ok = false;
      }
      if (!ok) {
        try {
          const area = document.createElement('textarea');
          area.value = text;
          area.setAttribute('readonly', '');
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          ok = document.execCommand('copy');
          area.remove();
        } catch {
          ok = false;
        }
      }
      setCopied(ok);
      setError(!ok);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setCopied(false);
        setError(false);
      }, resetMs);
      return ok;
    },
    [resetMs],
  );

  return { copied, error, copy };
}

export default useCopyToClipboard;

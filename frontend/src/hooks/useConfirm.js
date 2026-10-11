import { createElement, useCallback, useRef, useState } from 'react';
import ConfirmDialog from '../components/common/ConfirmDialog';

/**
 * Promise-based confirmation dialog.
 */
export function useConfirm() {
  const [options, setOptions] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setOptions(opts);
      }),
    [],
  );

  const close = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirmDialog = createElement(ConfirmDialog, {
    open: Boolean(options),
    ...(options || {}),
    onConfirm: () => close(true),
    onCancel: () => close(false),
  });

  return { confirm, confirmDialog };
}

export default useConfirm;

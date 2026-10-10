import { useCallback, useRef, useState } from 'react';
import ConfirmDialog from '../components/common/ConfirmDialog';

/**
 * Promise-based confirmation dialog.
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (await confirm({ title: 'Delete?', message: '…', confirmLabel: 'Delete' })) { … }
 *   return <>{…}{confirmDialog}</>;
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
    if (resolver.current) resolver.current(result);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirmDialog = (
    <ConfirmDialog open={Boolean(options)} {...(options || {})} onConfirm={() => close(true)} onCancel={() => close(false)} />
  );

  return { confirm, confirmDialog };
}

export default useConfirm;

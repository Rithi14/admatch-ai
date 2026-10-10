import { useContext } from 'react';
import { AuditContext } from '../context/auditContext';

/**
 * Access audits, mode and all audit actions.
 * Must be used inside <AuditProvider> (see main.jsx).
 */
export function useAudit() {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error('useAudit must be used inside <AuditProvider>.');
  return ctx;
}

export default useAudit;

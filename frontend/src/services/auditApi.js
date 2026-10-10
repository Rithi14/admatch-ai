/**
 * Audit service facade used by the app (via AuditProvider).
 *
 * It routes each call to one of two completely separate implementations:
 *   - demo mode -> demoAuditEngine + browser storage   (clearly labelled, not real AI)
 *   - live mode -> liveAuditApi                        (Python FastAPI backend)
 *
 * Results from the two modes are never mixed: demo audits live only in browser storage and live
 * audits only come from the backend.
 */

import { MODES } from '../utils/constants.js';
import { runDemoAnalysis } from './demoAuditEngine.js';
import { AuditValidationError, normalizeAudit } from './auditSchema.js';
import * as live from './liveAuditApi.js';
import * as store from './storage.js';

export const DEFAULT_MODE = import.meta.env?.VITE_DEFAULT_MODE === 'live' ? MODES.live : MODES.demo;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function createAudit(mode, input) {
  if (mode === MODES.live) return live.createAudit(input);

  // Demo: simulate a short processing time so the loading state is visible.
  await delay(1400);
  const audit = normalizeAudit(runDemoAnalysis(input), { defaultMode: 'demo' });
  const { items } = store.loadAudits();
  store.saveAudits([audit, ...items]);
  return audit;
}

/** @returns {{ items: object[], skipped: number, corrupted?: boolean }} */
export async function listAudits(mode) {
  if (mode === MODES.live) return live.listAudits();
  await delay(120);
  return store.loadAudits();
}

export async function deleteAudit(mode, id) {
  if (mode === MODES.live) return live.deleteAudit(id);
  const { items } = store.loadAudits();
  store.saveAudits(items.filter((a) => a.id !== id));
  return undefined;
}

export async function clearAudits(mode) {
  if (mode === MODES.live) return live.clearAudits();
  store.saveAudits([]);
  return undefined;
}

export async function restoreSamples(mode) {
  if (mode === MODES.live) return listAudits(mode);
  store.restoreSamples();
  return store.loadAudits();
}

export const checkBackend = live.checkHealth;
export { AuditValidationError };

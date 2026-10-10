/**
 * Browser persistence layer (DEMO MODE ONLY).
 *
 * localStorage is NOT a secure database: it is readable by any script on this origin, is limited
 * to a few MB, can be cleared by the user at any time and is not shared between browsers.
 * It is used here only so the demo survives page refreshes. Do not store secrets in it.
 *
 * - Data is wrapped in a versioned envelope: { version: 2, items: [...] }.
 * - Corrupt or outdated data is handled safely: invalid records are skipped (and reported),
 *   and unreadable data is backed up before being reset.
 * - Audits saved by the first version of the app (key "admatch-ai:audits:v1") are migrated.
 * - Falls back to in-memory storage when localStorage is unavailable (private mode, etc.).
 */

import { SCHEMA_VERSION } from '../utils/constants.js';
import { buildSampleAudits } from './demoSamples.js';
import { normalizeAudit, normalizeFailedAttempt } from './auditSchema.js';

export const STORAGE_KEYS = {
  audits: 'admatch:v2:audits',
  failed: 'admatch:v2:failed',
  recs: 'admatch:v2:rec-status',
  prefs: 'admatch:v2:prefs',
  legacy: 'admatch-ai:audits:v1',
};

export class StorageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorageError';
  }
}

/* ---------------- low-level access ---------------- */

const memory = new Map();
let persistent = null;

function getStore() {
  if (persistent !== null) return persistent || null;
  try {
    const s = globalThis.localStorage;
    const probe = '__admatch_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    persistent = s;
  } catch {
    persistent = false;
  }
  return persistent || null;
}

/** True when data will survive a page refresh. */
export function isPersistent() {
  return getStore() !== null;
}

/** Test helper: forget the cached localStorage probe. */
export function resetStorageProbe() {
  persistent = null;
  memory.clear();
}

function rawRead(key) {
  const store = getStore();
  if (!store) return memory.has(key) ? memory.get(key) : null;
  try {
    return store.getItem(key);
  } catch {
    return memory.has(key) ? memory.get(key) : null;
  }
}

function rawWrite(key, text) {
  const store = getStore();
  if (!store) {
    memory.set(key, text);
    return;
  }
  try {
    store.setItem(key, text);
  } catch (err) {
    if (err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014)) {
      throw new StorageError('Browser storage is full. Delete some audits or export your history, then try again.');
    }
    throw new StorageError('Could not save to browser storage.');
  }
}

function rawRemove(key) {
  const store = getStore();
  memory.delete(key);
  if (store) {
    try {
      store.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

function parseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/* ---------------- legacy (v1) migration ---------------- */

const SEVERITY_OK = ['high', 'medium', 'low'];

function migrateLegacyAudit(old) {
  if (!old || typeof old !== 'object') throw new Error('bad legacy record');
  const mismatches = Array.isArray(old.mismatches) ? old.mismatches : [];
  return {
    id: String(old.id),
    createdAt: old.createdAt,
    mode: 'demo',
    isSample: false,
    score: old.score,
    summary: old.summary || 'Imported from an earlier version of AdMatch AI.',
    input: {
      headline: old.headline,
      body: [old.description, old.claims].filter(Boolean).join('\n'),
      url: old.url,
    },
    landingPage: { url: old.url, contentSource: old.content ? 'pasted' : 'none', content: old.content || null },
    dimensions: [],
    findings: [],
    evidence: mismatches.map((m, i) => ({
      id: `e${i + 1}`,
      claim: m.adElement || 'Ad element',
      evidence: null,
      verified: 'unable',
      finding: m.issue || '',
      severity: SEVERITY_OK.includes(m.severity) ? m.severity : 'low',
      explanation: m.evidence || '',
      correction: m.recommendation || '',
    })),
    recommendations: mismatches.map((m, i) => ({
      id: `r${i + 1}`,
      title: m.issue || 'Recommendation',
      explanation: m.adElement || '',
      priority: SEVERITY_OK.includes(m.severity) ? m.severity : 'low',
      fix: m.recommendation || '',
      benefit: 'Imported from an earlier version. No estimate available.',
    })),
    analysis: { engine: 'demo-keyword', engineLabel: 'Demo keyword matcher', verified: false, note: 'Imported from an earlier version.' },
  };
}

function loadLegacy() {
  const text = rawRead(STORAGE_KEYS.legacy);
  if (!text) return [];
  const parsed = parseJson(text);
  if (!parsed.ok || !Array.isArray(parsed.value)) return [];
  const out = [];
  parsed.value.forEach((item) => {
    if (typeof item?.id === 'string' && item.id.startsWith('aud_sample_')) return; // old built-in samples
    try {
      out.push(normalizeAudit(migrateLegacyAudit(item), { defaultMode: 'demo' }));
    } catch {
      /* skip unreadable legacy record */
    }
  });
  return out;
}

/* ---------------- audits ---------------- */

function writeEnvelope(key, items) {
  rawWrite(key, JSON.stringify({ version: SCHEMA_VERSION, items }));
}

/**
 * Load demo audits. On first use the built-in samples (and any v1 audits) are written.
 * @returns {{ items: object[], skipped: number, corrupted: boolean }}
 */
export function loadAudits() {
  const text = rawRead(STORAGE_KEYS.audits);

  if (text === null) {
    const items = [...loadLegacy(), ...buildSampleAudits()];
    try {
      writeEnvelope(STORAGE_KEYS.audits, items);
    } catch {
      /* storage unavailable or full: still return the items for this session */
    }
    return { items, skipped: 0, corrupted: false };
  }

  const parsed = parseJson(text);
  const list = parsed.ok && parsed.value && parsed.value.version === SCHEMA_VERSION && Array.isArray(parsed.value.items) ? parsed.value.items : null;
  if (!list) {
    // Unreadable or from an unknown version: keep a backup, then start fresh.
    try {
      rawWrite(`${STORAGE_KEYS.audits}:backup`, text);
      writeEnvelope(STORAGE_KEYS.audits, []);
    } catch {
      /* ignore */
    }
    return { items: [], skipped: 0, corrupted: true };
  }

  const items = [];
  let skipped = 0;
  list.forEach((entry) => {
    try {
      items.push(normalizeAudit(entry, { defaultMode: 'demo' }));
    } catch {
      skipped += 1;
    }
  });
  return { items, skipped, corrupted: false };
}

export function saveAudits(items) {
  writeEnvelope(STORAGE_KEYS.audits, items);
}

/** Re-create the built-in samples (keeps the user's own audits). */
export function restoreSamples() {
  const { items } = loadAudits();
  const own = items.filter((a) => !a.isSample);
  const merged = [...own, ...buildSampleAudits()];
  saveAudits(merged);
  return merged;
}

/* ---------------- failed attempts ---------------- */

export function loadFailed() {
  const text = rawRead(STORAGE_KEYS.failed);
  if (!text) return [];
  const parsed = parseJson(text);
  if (!parsed.ok || !Array.isArray(parsed.value?.items)) return [];
  const out = [];
  parsed.value.items.forEach((entry) => {
    try {
      out.push(normalizeFailedAttempt(entry));
    } catch {
      /* skip invalid record */
    }
  });
  return out;
}

export function saveFailed(items) {
  // Do not keep the (potentially large) pasted page text beyond what is needed to retry.
  writeEnvelope(STORAGE_KEYS.failed, items);
}

/* ---------------- recommendation status ---------------- */

export function loadRecStatus() {
  const text = rawRead(STORAGE_KEYS.recs);
  if (!text) return {};
  const parsed = parseJson(text);
  if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) return {};
  const out = {};
  Object.entries(parsed.value).forEach(([auditId, recs]) => {
    if (recs && typeof recs === 'object' && !Array.isArray(recs)) {
      const done = Object.fromEntries(Object.entries(recs).filter(([, v]) => v === true));
      if (Object.keys(done).length) out[auditId] = done;
    }
  });
  return out;
}

export function saveRecStatus(map) {
  rawWrite(STORAGE_KEYS.recs, JSON.stringify(map));
}

/* ---------------- preferences ---------------- */

export function loadPrefs() {
  const text = rawRead(STORAGE_KEYS.prefs);
  if (!text) return {};
  const parsed = parseJson(text);
  if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object') return {};
  const mode = parsed.value.mode;
  return mode === 'demo' || mode === 'live' ? { mode } : {};
}

export function savePrefs(prefs) {
  rawWrite(STORAGE_KEYS.prefs, JSON.stringify(prefs));
}

/** Remove every AdMatch key (used by "Reset all local data"). */
export function clearAllLocalData() {
  Object.values(STORAGE_KEYS).forEach(rawRemove);
  rawRemove(`${STORAGE_KEYS.audits}:backup`);
}

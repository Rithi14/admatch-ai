import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../src/services/storage.js';
import { runDemoAnalysis } from '../src/services/demoAuditEngine.js';
import { normalizeAudit } from '../src/services/auditSchema.js';

function makeLocalStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    key: (i) => [...data.keys()][i] ?? null,
    get length() { return data.size; },
    _data: data,
  };
}
const install = (ls) => { globalThis.localStorage = ls; store.resetStorageProbe(); };
const audit = (id) =>
  normalizeAudit(
    runDemoAnalysis({ headline: 'Save 50% now', body: 'Free shipping on orders.', url: 'https://a.example/', pageText: 'Save 50% now. Shipping is free on orders over today.' }, { id }),
    { defaultMode: 'demo' },
  );

beforeEach(() => install(makeLocalStorage()));

test('first run seeds clearly flagged sample audits', () => {
  const { items } = store.loadAudits();
  assert.ok(items.length > 0);
  assert.ok(items.every((a) => a.isSample === true));
});

test('save then load round-trips and uses a versioned envelope', () => {
  store.saveAudits([audit('a1')]);
  const raw = JSON.parse(localStorage.getItem(store.STORAGE_KEYS.audits));
  assert.equal(raw.version, 2);
  assert.equal(store.loadAudits().items[0].id, 'a1');
});

test('corrupt JSON is backed up, reported and does not throw', () => {
  localStorage.setItem(store.STORAGE_KEYS.audits, '{not json');
  const r = store.loadAudits();
  assert.equal(r.corrupted, true);
  assert.ok(localStorage.getItem(store.STORAGE_KEYS.audits + ':backup'));
});

test('invalid records are skipped and counted', () => {
  localStorage.setItem(store.STORAGE_KEYS.audits, JSON.stringify({ version: 2, items: [audit('ok'), { bad: 1 }] }));
  const r = store.loadAudits();
  assert.equal(r.items.length, 1);
  assert.equal(r.skipped, 1);
});

test('recommendation progress and prefs persist', () => {
  store.saveRecStatus({ a1: { r1: true } });
  assert.deepEqual(store.loadRecStatus(), { a1: { r1: true } });
  store.savePrefs({ mode: 'live' });
  assert.equal(store.loadPrefs().mode, 'live');
});

test('falls back to memory when localStorage is blocked', () => {
  install({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } });
  assert.equal(store.isPersistent(), false);
  store.saveAudits([audit('m1')]);
  assert.equal(store.loadAudits().items[0].id, 'm1');
});

test('clearAllLocalData removes app keys only', () => {
  localStorage.setItem('unrelated', 'keep');
  store.saveAudits([audit('z')]);
  store.clearAllLocalData();
  assert.equal(localStorage.getItem('unrelated'), 'keep');
  assert.equal(localStorage.getItem(store.STORAGE_KEYS.audits), null);
});

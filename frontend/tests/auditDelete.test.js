import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../src/services/storage.js';
import { deleteAudit, listAudits } from '../src/services/auditApi.js';
import { API_BASE_URL } from '../src/services/apiClient.js';
import { MODES } from '../src/utils/constants.js';

function makeLocalStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
    key: (index) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
}

beforeEach(() => {
  globalThis.localStorage = makeLocalStorage();
  store.resetStorageProbe();
});

test('demo deletion persists in browser storage and stays deleted when reloaded', async () => {
  const existing = store.loadAudits().items[0];
  assert.ok(existing);

  await deleteAudit(MODES.demo, existing.id);

  assert.ok(
    !JSON.parse(localStorage.getItem(store.STORAGE_KEYS.audits)).items.some(
      (audit) => audit.id === existing.id,
    ),
  );

  store.resetStorageProbe();
  const reloaded = await listAudits(MODES.demo);
  assert.ok(!reloaded.items.some((audit) => audit.id === existing.id));
});

test('live deletion sends the backend audit ID and does not alter demo storage', async () => {
  const demoAudits = store.loadAudits().items;
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(null, { status: 204 });
  };

  try {
    await deleteAudit(MODES.live, 'backend-id/with spaces');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    `${API_BASE_URL}/api/audits/backend-id%2Fwith%20spaces`,
  );
  assert.equal(calls[0].options.method, 'DELETE');
  assert.deepEqual(
    store.loadAudits().items.map((audit) => audit.id),
    demoAudits.map((audit) => audit.id),
  );
});

test('live deletion surfaces the actual backend error response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ detail: 'Audit not found.' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });

  try {
    await assert.rejects(deleteAudit(MODES.live, 'missing-id'), {
      message: 'Audit not found.',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

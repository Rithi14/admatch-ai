import test from 'node:test';
import assert from 'node:assert/strict';
import { request, ApiError } from '../src/services/apiClient.js';

const withFetch = async (impl, fn) => {
  const orig = globalThis.fetch;
  globalThis.fetch = impl;
  try { await fn(); } finally { globalThis.fetch = orig; }
};
const kind = async (p) => { try { await p; } catch (e) { assert.ok(e instanceof ApiError); return e.kind; } throw new Error('did not throw'); };

test('network failure -> kind "network"', () =>
  withFetch(async () => { throw new TypeError('Failed to fetch'); }, async () => {
    assert.equal(await kind(request('/api/x')), 'network');
  }));

test('HTTP 500 -> kind "server"', () =>
  withFetch(async () => new Response('{"detail":"boom"}', { status: 500, headers: { 'content-type': 'application/json' } }), async () => {
    assert.equal(await kind(request('/api/x')), 'server');
  }));

test('HTTP 422 with FastAPI detail array -> kind "client"', () =>
  withFetch(async () => new Response(JSON.stringify({ detail: [{ msg: 'field required', loc: ['body', 'url'] }] }), { status: 422, headers: { 'content-type': 'application/json' } }), async () => {
    assert.equal(await kind(request('/api/x')), 'client');
  }));

test('non-JSON 200 -> kind "invalid_response"', () =>
  withFetch(async () => new Response('<html>oops</html>', { status: 200, headers: { 'content-type': 'text/html' } }), async () => {
    assert.equal(await kind(request('/api/x')), 'invalid_response');
  }));

test('timeout -> kind "timeout"', () =>
  withFetch((url, opts) => new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))), async () => {
    assert.equal(await kind(request('/api/x', { timeoutMs: 30 })), 'timeout');
  }));

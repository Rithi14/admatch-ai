import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAudit, normalizeAuditList, quoteInContent, AuditValidationError } from '../src/services/auditSchema.js';
import { runDemoAnalysis } from '../src/services/demoAuditEngine.js';

const sample = () =>
  runDemoAnalysis({
    headline: 'Save 50% on shoes',
    body: 'Free shipping on all orders today.',
    cta: 'Shop now',
    url: 'https://shop.example/x',
    pageText: 'Save 50% on shoes. Shipping is free on all orders. Shop now.',
  });

test('valid audit passes normalisation', () => {
  const a = normalizeAudit(sample(), { defaultMode: 'demo' });
  assert.equal(typeof a.score, 'number');
  assert.ok(Array.isArray(a.evidence));
});

test('rejects non-object and missing score', () => {
  assert.throws(() => normalizeAudit(null), AuditValidationError);
  assert.throws(() => normalizeAudit({ id: 'x' }), AuditValidationError);
});

test('list normaliser skips and counts invalid items', () => {
  const r = normalizeAuditList([sample(), { nonsense: true }, 42], { defaultMode: 'demo' });
  assert.equal(r.items.length, 1);
  assert.equal(r.skipped, 2);
});

test('quoteInContent finds real quotes only', () => {
  assert.equal(quoteInContent('save 50% on shoes', 'Please Save 50% on   shoes today'), true);
  assert.equal(quoteInContent('save 90% on shoes', 'Please Save 50% on shoes today'), false);
});

test('live results cannot claim verified unless backend opts in', () => {
  const raw = JSON.parse(JSON.stringify(sample()));
  raw.analysis = { engine: 'llm', engineLabel: 'LLM', verified: false };
  const a = normalizeAudit(raw, { defaultMode: 'live' });
  assert.notEqual(a.analysis.verified, true);
});

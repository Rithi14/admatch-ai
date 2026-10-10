import test from 'node:test';
import assert from 'node:assert/strict';
import { runDemoAnalysis, quantities, extractClaims } from '../src/services/demoAuditEngine.js';
import { normalizeAudit } from '../src/services/auditSchema.js';
import { EXAMPLE_INPUTS } from '../src/services/demoSamples.js';

const base = { headline: '', body: '', cta: '', url: 'https://shop.example/x', audience: '', goal: '', industry: '' };

test('percent discount contradiction is flagged high severity', () => {
  const a = runDemoAnalysis({
    ...base,
    headline: 'Get 50% off all running shoes',
    body: 'Free shipping on every order.',
    pageText: 'Our running shoes are on sale. Save 20% on selected styles. Shipping rates apply at checkout. Add to cart today.',
  });
  assert.ok(a.score >= 0 && a.score <= 100);
  assert.ok(a.evidence.some((e) => e.severity === 'high'), 'expected a high severity finding');
});

test('duration contradiction 30-day vs 14 days is detected', () => {
  const a = runDemoAnalysis({
    ...base,
    headline: 'Start your 30-day free trial',
    body: 'No credit card needed.',
    pageText: 'Try the product with a 14 days trial. Credit card required to start. Sign up now.',
  });
  assert.ok(a.evidence.some((e) => e.severity === 'high'));
});

test('matching copy scores higher than contradicting copy', () => {
  const good = runDemoAnalysis({
    ...base,
    headline: 'Save 50% on running shoes',
    body: 'Free shipping on all orders.',
    cta: 'Shop now',
    pageText: 'Save 50% on running shoes today. Shipping is free on all orders. Shop now and run faster.',
  });
  const bad = runDemoAnalysis({
    ...base,
    headline: 'Save 50% on running shoes',
    body: 'Free shipping on all orders.',
    cta: 'Shop now',
    pageText: 'Welcome to our store. Save 10% on socks. Standard shipping costs $9.',
  });
  assert.ok(good.score > bad.score, `${good.score} should exceed ${bad.score}`);
});

test('result is always labelled as demo and unverified', () => {
  const a = runDemoAnalysis({ ...base, headline: 'Hello world offer', body: 'Some body copy here.', pageText: 'x'.repeat(60) });
  assert.equal(a.analysis.verified, false);
  assert.equal(a.analysis.engine, 'demo-keyword');
  const n = normalizeAudit(a, { defaultMode: 'demo' });
  assert.equal(n.mode, 'demo');
});

test('evidence quotes are never invented: every quote appears in the page text', () => {
  for (const ex of Object.values(EXAMPLE_INPUTS)) {
    const input = { ...base, ...ex, url: ex.url || base.url };
    const pageText = ex.pageText || '';
    const a = runDemoAnalysis(input);
    const squash = (s) => s.toLowerCase().replace(/\s+/g, ' ');
    for (const e of a.evidence) {
      if (e.evidence) {
        assert.ok(squash(pageText).includes(squash(e.evidence).replace(/^[“"]|[”"]$/g, '')), `quote not on page: ${e.evidence}`);
      } else {
        assert.ok(['not_found', 'unable'].includes(e.verified), 'missing evidence must be marked');
      }
    }
  }
});

test('quantities keeps leading digits (regression: "50% off")', () => {
  const q = quantities('Get 50% off and a 30-day trial');
  assert.ok(JSON.stringify(q).includes('50'));
  assert.ok(JSON.stringify(q).includes('30'));
});

test('extractClaims caps at 8 claims', () => {
  const body = Array.from({ length: 20 }, (_, i) => `Feature number ${i} is included for everyone.`).join(' ');
  assert.ok(extractClaims({ ...base, headline: 'Big headline here', body }).length <= 8);
});

test('analysis is deterministic for the same input', () => {
  const input = { ...base, headline: 'Save 40% today', body: 'Limited time offer.', pageText: 'Save 40% today on everything in store, limited time.' };
  const now = new Date('2026-01-01T00:00:00Z');
  const a = runDemoAnalysis(input, { now, id: 't1' });
  const b = runDemoAnalysis(input, { now, id: 't1' });
  assert.deepEqual(a, b);
});

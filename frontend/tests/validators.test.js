import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLandingUrl, validateAuditInput } from '../src/utils/validators.js';

test('accepts normal https URLs', () => {
  assert.equal(validateLandingUrl('https://shop.example.com/page').ok, true);
});

test('rejects unsafe or non-public URLs', () => {
  const bad = [
    'javascript:alert(1)',
    'file:///etc/passwd',
    'ftp://example.com',
    'http://localhost:3000',
    'http://127.0.0.1',
    'http://192.168.1.5/admin',
    'http://10.0.0.2',
    'http://169.254.169.254/latest/meta-data',
    'https://user:pass@example.com',
    'http://intranet',
    'https://printer.local',
    '',
    'not a url',
  ];
  for (const u of bad) assert.equal(validateLandingUrl(u).ok, false, `should reject: ${u}`);
});

test('validateAuditInput requires headline, body and valid url', () => {
  const { errors } = validateAuditInput({ headline: '', body: '', url: '' });
  assert.ok(errors.headline && errors.body && errors.url);
});

test('validateAuditInput requires page text in demo mode only', () => {
  const raw = { headline: 'Great headline', body: 'Some good body copy', url: 'https://a.example.com', goal: '' };
  assert.ok(validateAuditInput(raw, { requirePageText: true }).errors.pageText);
  assert.equal(validateAuditInput(raw, { requirePageText: false }).errors.pageText, undefined);
});

test('enforces length limits', () => {
  const { errors } = validateAuditInput({ headline: 'x'.repeat(500), body: 'y'.repeat(5000), url: 'https://a.example.com' });
  assert.ok(errors.headline && errors.body);
});

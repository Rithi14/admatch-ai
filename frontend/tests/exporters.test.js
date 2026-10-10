import test from 'node:test';
import assert from 'node:assert/strict';
import { auditsToCsv } from '../src/utils/exporters.js';

test('CSV export neutralises spreadsheet formula injection', () => {
  const csv = auditsToCsv([{ id: '1', createdAt: '2026-01-01T00:00:00Z', headline: '=HYPERLINK("http://evil")', url: 'https://a.example', score: 50, status: 'completed', mode: 'demo', evidence: [], recommendations: [] }]);
  assert.ok(!/(^|,|\n)"?=HYPERLINK/.test(csv), csv);
});

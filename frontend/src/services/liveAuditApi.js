/**
 * LIVE audit API – talks to the (future) Python FastAPI backend.
 *
 * Nothing in this file produces fake results. If the backend is down, slow or returns data that
 * does not match the contract, an `ApiError` is thrown and the UI shows it.
 *
 * Expected endpoints (see README.md → "Backend integration"):
 *   GET    /api/health            -> { "status": "ok" }
 *   POST   /api/audits            -> Audit            (body: see `toRequestBody`)
 *   GET    /api/audits            -> Audit[] | { items: Audit[] }
 *   GET    /api/audits/{id}       -> Audit
 *   DELETE /api/audits/{id}       -> 204
 *   DELETE /api/audits            -> 204              (clear all)
 */

import { ApiError, request } from './apiClient.js';
import { AuditValidationError, normalizeAudit, normalizeAuditList } from './auditSchema.js';

function validated(fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof AuditValidationError) {
      throw new ApiError('invalid_response', `The backend response did not match the expected format. ${err.message}`, { details: err.details });
    }
    throw err;
  }
}

function toRequestBody(input) {
  const body = {
    headline: input.headline,
    body: input.body,
    cta: input.cta || null,
    url: input.url,
    audience: input.audience || null,
    goal: input.goal || null,
    industry: input.industry || null,
  };
  // Optional: let the user supply the page text if the backend cannot fetch the page itself.
  if (input.pageText) body.landingPageText = input.pageText;
  return body;
}

export async function checkHealth() {
  const data = await request('/api/health', { timeoutMs: 8000 });
  if (!data || typeof data !== 'object') {
    throw new ApiError('invalid_response', 'The health endpoint returned an unexpected response.');
  }
  return data;
}

export async function createAudit(input, options = {}) {
  const data = await request('/api/audits', { method: 'POST', body: toRequestBody(input), ...options });
  return validated(() => normalizeAudit(data, { defaultMode: 'live' }));
}

export async function listAudits() {
  const data = await request('/api/audits');
  return validated(() => normalizeAuditList(data, { defaultMode: 'live' }));
}

export async function getAudit(id) {
  const data = await request(`/api/audits/${encodeURIComponent(id)}`);
  return validated(() => normalizeAudit(data, { defaultMode: 'live' }));
}

export async function deleteAudit(id) {
  await request(`/api/audits/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function clearAudits() {
  await request('/api/audits', { method: 'DELETE' });
}

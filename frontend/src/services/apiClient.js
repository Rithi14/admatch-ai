/**
 * Small fetch wrapper used by the live (backend) API.
 * - Reads the base URL and timeout from Vite environment variables.
 * - Never sends or stores secrets: any API key belongs on the backend, not here.
 * - Converts every failure into an `ApiError` with a machine-readable `kind`.
 */

export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
export const API_TIMEOUT_MS = Number(import.meta.env?.VITE_API_TIMEOUT_MS) > 0 ? Number(import.meta.env.VITE_API_TIMEOUT_MS) : 30000;

export class ApiError extends Error {
  /**
   * @param {'network'|'timeout'|'server'|'client'|'invalid_response'|'aborted'} kind
   */
  constructor(kind, message, { status = null, details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.details = details;
  }
}

/** Human friendly text for an error (what the UI shows). */
export function describeError(err) {
  if (err instanceof ApiError) return err.message;
  if (err && typeof err.message === 'string' && err.message) return err.message;
  return 'Something went wrong. Please try again.';
}

function detailText(body) {
  if (!body) return '';
  if (typeof body.detail === 'string') return body.detail;
  if (Array.isArray(body.detail)) {
    // FastAPI validation errors: [{ loc: [...], msg: '...' }]
    return body.detail
      .map((d) => `${Array.isArray(d.loc) ? d.loc.filter((p) => p !== 'body').join('.') : ''} ${d.msg || ''}`.trim())
      .filter(Boolean)
      .join('; ');
  }
  if (typeof body.message === 'string') return body.message;
  return '';
}

/**
 * @param {string} path e.g. '/api/audits'
 * @param {{ method?: string, body?: unknown, timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<unknown>} parsed JSON (or null for 204)
 */
export async function request(path, { method = 'GET', body, timeoutMs = API_TIMEOUT_MS, signal } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (timedOut) {
      throw new ApiError('timeout', `The backend did not respond within ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    if (err && err.name === 'AbortError') throw new ApiError('aborted', 'The request was cancelled.');
    throw new ApiError('network', `Could not reach the backend at ${API_BASE_URL}. Check that it is running and that CORS allows this site.`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let parsed = null;
    try {
      parsed = await response.json();
    } catch {
      /* body was not JSON */
    }
    const detail = detailText(parsed);
    if (response.status >= 500) {
      throw new ApiError('server', detail || `The backend reported an error (HTTP ${response.status}). Try again in a moment.`, { status: response.status });
    }
    throw new ApiError('client', detail || `The backend rejected the request (HTTP ${response.status}).`, { status: response.status });
  }

  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    throw new ApiError('invalid_response', 'The backend returned a response that is not valid JSON.', { status: response.status });
  }
}

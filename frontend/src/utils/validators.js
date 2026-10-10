import { GOALS, LIMITS, MIN_PAGE_TEXT } from './constants.js';

/** Remove control characters (keeps tabs/newlines) and normalise line endings. */
export function sanitizeText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

/** Lower-case, collapse whitespace and unify quotes/dashes so quotes can be compared reliably. */
export function normalizeForMatch(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan')) return true;
  if (host === '::1' || host === '0.0.0.0' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
    // IPv6 loopback / link-local / unique-local (only when it looks like an IPv6 literal)
    if (host.includes(':')) return true;
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

/**
 * Validate a landing page URL.
 * Rejects non-http(s) schemes, embedded credentials, local/private hosts and hosts without a dot.
 * NOTE: this is a UX check only. A backend must repeat (and enforce) these checks before fetching.
 */
export function validateLandingUrl(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { ok: false, error: 'Enter the landing page URL.' };
  if (text.length > LIMITS.url) return { ok: false, error: `URL is too long (max ${LIMITS.url} characters).` };
  if (/\s/.test(text)) return { ok: false, error: 'URL cannot contain spaces.' };

  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return { ok: false, error: 'Enter a full URL that starts with https:// (for example https://example.com/offer).' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, error: 'Only http:// and https:// links are supported.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'URLs with embedded usernames or passwords are not allowed.' };
  }
  if (isPrivateHost(parsed.hostname)) {
    return { ok: false, error: 'Local or private network addresses are not supported. Use a public landing page URL.' };
  }
  if (!parsed.hostname.includes('.') && !parsed.hostname.includes(':')) {
    return { ok: false, error: 'The URL needs a full domain name, such as example.com.' };
  }
  return { ok: true, url: parsed.toString() };
}

const GOAL_VALUES = GOALS.map((g) => g.value);

/**
 * Validate and clean audit form values.
 * @returns {{ errors: Record<string,string>, values: object }}
 */
export function validateAuditInput(raw, { requirePageText = false } = {}) {
  const values = {
    headline: sanitizeText(raw.headline).trim(),
    body: sanitizeText(raw.body).trim(),
    cta: sanitizeText(raw.cta).trim(),
    url: String(raw.url ?? '').trim(),
    audience: sanitizeText(raw.audience).trim(),
    goal: String(raw.goal ?? '').trim(),
    industry: sanitizeText(raw.industry).trim(),
    pageText: sanitizeText(raw.pageText).trim(),
  };
  const errors = {};

  if (!values.headline) errors.headline = 'Enter the ad headline.';
  else if (values.headline.length > LIMITS.headline) errors.headline = `Keep the headline under ${LIMITS.headline} characters.`;

  if (!values.body) errors.body = 'Enter the ad description or body copy.';
  else if (values.body.length < 10) errors.body = 'Add a little more ad copy (at least 10 characters).';
  else if (values.body.length > LIMITS.body) errors.body = `Keep the body copy under ${LIMITS.body} characters.`;

  if (values.cta.length > LIMITS.cta) errors.cta = `Keep the call-to-action under ${LIMITS.cta} characters.`;

  const urlCheck = validateLandingUrl(values.url);
  if (!urlCheck.ok) errors.url = urlCheck.error;
  else values.url = urlCheck.url;

  if (values.audience.length > LIMITS.audience) errors.audience = `Keep this under ${LIMITS.audience} characters.`;
  if (values.industry.length > LIMITS.industry) errors.industry = `Keep this under ${LIMITS.industry} characters.`;
  if (!GOAL_VALUES.includes(values.goal)) errors.goal = 'Choose one of the listed goals.';

  if (values.pageText.length > LIMITS.pageText) {
    errors.pageText = `Landing page text is too long (max ${LIMITS.pageText.toLocaleString()} characters).`;
  } else if (requirePageText && values.pageText.length < MIN_PAGE_TEXT) {
    errors.pageText = `Demo mode cannot visit websites. Paste the landing page text (at least ${MIN_PAGE_TEXT} characters).`;
  } else if (values.pageText && values.pageText.length < MIN_PAGE_TEXT) {
    errors.pageText = `Paste at least ${MIN_PAGE_TEXT} characters, or leave this empty.`;
  }

  return { errors, values };
}

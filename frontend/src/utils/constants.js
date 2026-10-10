// Shared constants. Keep this file free of React/DOM imports so Node tests can load it.

export const SCHEMA_VERSION = 2;

/** Score categories, highest first. `tone` drives colours in the UI. */
export const SCORE_CATEGORIES = [
  { key: 'excellent', label: 'Excellent', min: 85, tone: 'excellent' },
  { key: 'good', label: 'Good', min: 70, tone: 'good' },
  { key: 'needs', label: 'Needs improvement', min: 50, tone: 'needs' },
  { key: 'poor', label: 'Poor', min: 0, tone: 'poor' },
];

export function getScoreCategory(score) {
  const value = Number.isFinite(score) ? score : 0;
  return SCORE_CATEGORIES.find((c) => value >= c.min) || SCORE_CATEGORIES[SCORE_CATEGORIES.length - 1];
}

/** `none` is used for evidence items that are supported (no issue). */
export const SEVERITIES = ['high', 'medium', 'low'];
export const SEVERITY_RANK = { high: 0, medium: 1, low: 2, none: 3 };
export const SEVERITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low', none: 'Supported' };

export const VERIFY_STATES = ['found', 'partial', 'not_found', 'unable'];
export const VERIFY_LABELS = {
  found: 'Evidence found',
  partial: 'Partial evidence',
  not_found: 'Evidence not found',
  unable: 'Unable to verify',
};

/** Scoring dimensions. Weights are re-normalised over the dimensions that could be assessed. */
export const DIMENSIONS = [
  {
    key: 'consistency',
    label: 'Message consistency',
    weight: 0.25,
    help: 'Do the words and topics used in the ad also appear on the landing page?',
  },
  {
    key: 'promise',
    label: 'Promise fulfillment',
    weight: 0.3,
    help: 'Is each claim in the ad backed by text on the landing page?',
  },
  {
    key: 'cta',
    label: 'CTA alignment',
    weight: 0.15,
    help: 'Does the landing page offer the same action the ad asks for?',
  },
  {
    key: 'offer',
    label: 'Offer alignment',
    weight: 0.15,
    help: 'Do prices, discounts, guarantees and deadlines match between ad and page?',
  },
  {
    key: 'trust',
    label: 'Trust & clarity',
    weight: 0.15,
    help: 'Does the page contain basic trust signals and a clear next step?',
  },
];

export const FINDING_KINDS = [
  { key: 'missing', label: 'Missing claims' },
  { key: 'contradictory', label: 'Contradictory claims' },
  { key: 'weak', label: 'Weakly supported promises' },
  { key: 'clarity', label: 'Landing page clarity issues' },
  { key: 'trust', label: 'Trust & conversion opportunities' },
];

export const GOALS = [
  { value: '', label: 'Not specified' },
  { value: 'sales', label: 'Online sales' },
  { value: 'leads', label: 'Lead generation' },
  { value: 'signups', label: 'Sign-ups / free trials' },
  { value: 'traffic', label: 'Website traffic' },
  { value: 'awareness', label: 'Brand awareness' },
];

export const INDUSTRIES = [
  'E-commerce',
  'SaaS / software',
  'Education',
  'Finance',
  'Health & wellness',
  'Travel',
  'Real estate',
  'Agency / services',
  'Other',
];

/** Maximum lengths for form fields (also enforced in validators). */
export const LIMITS = {
  headline: 200,
  body: 2000,
  cta: 80,
  url: 2048,
  audience: 200,
  industry: 100,
  pageText: 50000,
};

export const MIN_PAGE_TEXT = 40;

export const MODES = { demo: 'demo', live: 'live' };

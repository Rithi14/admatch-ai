/**
 * Audit data contract (schema version 2) + validation.
 *
 * Normalizes audit data from the backend, localStorage, or demo engine.
 * Keeps optional ProofGraph, contradiction, fine-print, and section data
 * while maintaining safe defaults for older audits.
 */

import {
  DIMENSIONS,
  FINDING_KINDS,
  SCHEMA_VERSION,
  SEVERITIES,
  VERIFY_STATES,
} from '../utils/constants.js';

import { normalizeForMatch } from '../utils/validators.js';

export class AuditValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'AuditValidationError';
    this.details = details;
  }
}

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const asString = (value, fallback = '') =>
  typeof value === 'string'
    ? value
    : value == null
      ? fallback
      : String(value);

const FINDING_KEYS = FINDING_KINDS.map((item) => item.key);

const DIMENSION_LABELS = Object.fromEntries(
  DIMENSIONS.map((item) => [item.key, item.label]),
);

function fail(path, message) {
  throw new AuditValidationError(
    `Invalid audit data at "${path}": ${message}`,
    [path],
  );
}

function requireString(value, path) {
  if (typeof value !== 'string' || !value.trim()) {
    fail(path, 'expected a non-empty string');
  }
  return value;
}

function array(value, path) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    fail(path, 'expected a list');
  }
  return value;
}

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/**
 * Checks whether a quotation appears in the supplied page content.
 */
export function quoteInContent(quote, content) {
  const cleanQuote = normalizeForMatch(quote).replace(
    /^[…"'\s.]+|[…"'\s.]+$/g,
    '',
  );

  if (!cleanQuote) return false;

  return normalizeForMatch(content).includes(cleanQuote);
}

function normalizeEvidence(raw, index, pageContent) {
  const path = `evidence[${index}]`;

  if (!isObject(raw)) {
    fail(path, 'expected an object');
  }

  const claim = requireString(raw.claim, `${path}.claim`);

  let quote =
    typeof raw.evidence === 'string' && raw.evidence.trim()
      ? raw.evidence.trim()
      : null;

  let verified = pick(
    raw.verified,
    VERIFY_STATES,
    quote ? 'partial' : 'unable',
  );

  let quoteWarning = null;

  // Do not display quotations that cannot be found in page content.
  if (quote && pageContent && !quoteInContent(quote, pageContent)) {
    quote = null;
    verified = 'unable';

    quoteWarning =
      'The analysis returned a quotation that does not appear in the landing page text, so it was removed.';
  }

  if (!quote && (verified === 'found' || verified === 'partial')) {
    verified = 'unable';
  }

  return {
    id: asString(raw.id, `e${index + 1}`) || `e${index + 1}`,
    claim,
    evidence: quote,
    verified,
    location: asString(raw.location, 'unknown'),
    finding: asString(raw.finding),
    severity: pick(raw.severity, [...SEVERITIES, 'none'], 'low'),
    explanation: asString(raw.explanation),
    correction: asString(raw.correction),
    ...(quoteWarning ? { quoteWarning } : {}),
  };
}

function normalizeRecommendation(raw, index) {
  const path = `recommendations[${index}]`;

  if (!isObject(raw)) {
    fail(path, 'expected an object');
  }

  return {
    id: asString(raw.id, `r${index + 1}`) || `r${index + 1}`,
    title: requireString(raw.title, `${path}.title`),
    explanation: asString(raw.explanation),
    priority: pick(raw.priority, SEVERITIES, 'medium'),
    fix: asString(raw.fix),
    benefit: asString(raw.benefit),
    replacement:
      typeof raw.replacement === 'string' && raw.replacement.trim()
        ? raw.replacement
        : null,
  };
}

function normalizeFinding(raw, index) {
  const path = `findings[${index}]`;

  if (!isObject(raw)) {
    fail(path, 'expected an object');
  }

  return {
    id: asString(raw.id, `f${index + 1}`) || `f${index + 1}`,
    kind: pick(raw.kind, FINDING_KEYS, 'clarity'),
    title: requireString(raw.title, `${path}.title`),
    text: asString(raw.text),
  };
}

function normalizeDimension(raw, index) {
  const path = `dimensions[${index}]`;

  if (!isObject(raw)) {
    fail(path, 'expected an object');
  }

  const key = requireString(raw.key, `${path}.key`);

  const score =
    typeof raw.score === 'number' && Number.isFinite(raw.score)
      ? Math.max(0, Math.min(100, Math.round(raw.score)))
      : null;

  return {
    key,
    label: asString(raw.label, DIMENSION_LABELS[key] || key) || key,
    score,
    note: asString(raw.note),
  };
}

function normalizeInput(raw) {
  if (!isObject(raw)) {
    fail('input', 'expected an object');
  }

  return {
    headline: requireString(raw.headline, 'input.headline'),
    body: asString(raw.body),
    cta: asString(raw.cta),
    url: asString(raw.url),
    audience: asString(raw.audience),
    goal: asString(raw.goal),
    industry: asString(raw.industry),
  };
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function normalizeSections(rawSections) {
  return array(rawSections, 'landingPage.sections').map(
    (section, index) => {
      const path = `landingPage.sections[${index}]`;

      if (!isObject(section)) {
        fail(path, 'expected an object');
      }

      return {
        name: asString(section.name, 'Page content'),
        text: asString(section.text),
        sentences: array(
          section.sentences,
          `${path}.sentences`,
        ).map((sentence) => asString(sentence)),
      };
    },
  );
}

function normalizeProofGraph(raw) {
  if (!isObject(raw)) return null;

  const nodes = array(raw.nodes, 'proofGraph.nodes').filter(isObject);
  const edges = array(raw.edges, 'proofGraph.edges').filter(isObject);
  const summary = isObject(raw.summary) ? raw.summary : {};

  return {
    nodes: nodes.map((node, index) => ({
      id: asString(node.id, `node-${index + 1}`),
      type: asString(node.type, 'unknown'),
      label: asString(node.label, `Node ${index + 1}`),
      ...(node.text != null ? { text: asString(node.text) } : {}),
      ...(node.status != null
        ? { status: asString(node.status) }
        : {}),
    })),

    edges: edges.map((edge) => ({
      source: asString(edge.source),
      target: asString(edge.target),
      type: asString(edge.type, 'related'),
    })),

    summary: {
      claimCount: Number.isFinite(summary.claimCount)
        ? summary.claimCount
        : 0,
      evidenceCount: Number.isFinite(summary.evidenceCount)
        ? summary.evidenceCount
        : 0,
      sectionCount: Number.isFinite(summary.sectionCount)
        ? summary.sectionCount
        : 0,
      connectionCount: Number.isFinite(summary.connectionCount)
        ? summary.connectionCount
        : edges.length,
    },
  };
}

function normalizeIssueSummary(raw) {
  const summary = isObject(raw) ? raw : {};

  return {
    contradictionCount: Number.isFinite(summary.contradictionCount)
      ? summary.contradictionCount
      : 0,
    finePrintCount: Number.isFinite(summary.finePrintCount)
      ? summary.finePrintCount
      : 0,
  };
}

/**
 * Validate and normalize a completed audit.
 */
export function normalizeAudit(raw, { defaultMode = 'live' } = {}) {
  if (!isObject(raw)) {
    fail('audit', 'expected an object');
  }

  const id = raw.id == null ? '' : String(raw.id);

  if (!id.trim()) {
    fail('id', 'missing audit id');
  }

  const created = new Date(raw.createdAt);

  if (!raw.createdAt || Number.isNaN(created.getTime())) {
    fail('createdAt', 'expected a valid date');
  }

  if (
    typeof raw.score !== 'number' ||
    !Number.isFinite(raw.score)
  ) {
    fail('score', 'expected a number between 0 and 100');
  }

  if (raw.score < 0 || raw.score > 100) {
    fail('score', 'score must be between 0 and 100');
  }

  const input = normalizeInput(raw.input);
  const mode = pick(raw.mode, ['demo', 'live'], defaultMode);
  const lp = isObject(raw.landingPage) ? raw.landingPage : {};

  const pageContent =
    typeof lp.content === 'string' && lp.content.trim()
      ? lp.content
      : null;

  const landingUrl = asString(lp.url, input.url) || input.url;
  const analysisRaw = isObject(raw.analysis) ? raw.analysis : {};

  const engine =
    asString(
      analysisRaw.engine,
      mode === 'demo' ? 'demo-keyword' : 'backend',
    ) || 'backend';

  const audit = {
    schemaVersion: SCHEMA_VERSION,
    id,
    createdAt: created.toISOString(),
    status: 'completed',
    mode,
    isSample: raw.isSample === true,
    input,

    landingPage: {
      url: landingUrl,
      hostname: asString(lp.hostname) || hostnameOf(landingUrl),
      contentSource: pick(
        lp.contentSource,
        ['pasted', 'fetched', 'none'],
        pageContent ? 'pasted' : 'none',
      ),
      content: pageContent,
      wordCount:
        typeof lp.wordCount === 'number'
          ? lp.wordCount
          : pageContent
            ? pageContent.split(/\s+/).filter(Boolean).length
            : 0,
      sections: normalizeSections(lp.sections),
    },

    score: Math.round(raw.score),
    dimensions: array(raw.dimensions, 'dimensions').map(normalizeDimension),
    summary: asString(raw.summary),
    findings: array(raw.findings, 'findings').map(normalizeFinding),
    evidence: array(raw.evidence, 'evidence').map((item, index) =>
      normalizeEvidence(item, index, pageContent),
    ),
    recommendations: array(
      raw.recommendations,
      'recommendations',
    ).map(normalizeRecommendation),

    contradictions: array(raw.contradictions, 'contradictions').filter(isObject),
    finePrint: array(raw.finePrint, 'finePrint').filter(isObject),
    issueSummary: normalizeIssueSummary(raw.issueSummary),
    proofGraph: normalizeProofGraph(raw.proofGraph),

    analysis: {
      engine,
      engineLabel:
        asString(analysisRaw.engineLabel) ||
        (engine === 'demo-keyword'
          ? 'Demo keyword matcher'
          : 'Backend analysis'),
      verified: mode === 'demo' ? false : analysisRaw.verified === true,
      note: asString(analysisRaw.note),
    },
  };

  return audit;
}

/**
 * A failed audit attempt saved locally so the user can retry it.
 */
export function normalizeFailedAttempt(raw) {
  if (!isObject(raw)) {
    fail('failedAttempt', 'expected an object');
  }

  const id = raw.id == null ? '' : String(raw.id);

  if (!id.trim()) {
    fail('id', 'missing id');
  }

  const created = new Date(raw.createdAt);

  if (Number.isNaN(created.getTime())) {
    fail('createdAt', 'expected a valid date');
  }

  const input = normalizeInput(raw.input);

  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    createdAt: created.toISOString(),
    status: 'failed',
    mode: pick(raw.mode, ['demo', 'live'], 'live'),
    isSample: false,
    input,
    pageText: typeof raw.pageText === 'string' ? raw.pageText : '',
    error: asString(raw.error, 'The audit could not be completed.'),
    score: 0,
    evidence: [],
    recommendations: [],
  };
}

/**
 * Normalize a list of audits.
 * Invalid entries are skipped and counted.
 */
export function normalizeAuditList(raw, options) {
  const list = Array.isArray(raw)
    ? raw
    : isObject(raw) && Array.isArray(raw.items)
      ? raw.items
      : null;

  if (!list) {
    fail('audits', 'expected a list of audits');
  }

  const items = [];
  let skipped = 0;

  list.forEach((entry) => {
    try {
      items.push(normalizeAudit(entry, options));
    } catch {
      skipped += 1;
    }
  });

  return { items, skipped };
}
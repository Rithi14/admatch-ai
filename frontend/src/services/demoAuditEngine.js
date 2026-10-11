/**
 * DEMO analysis engine.
 *
 * This is NOT AI. It is a transparent keyword / number matcher that runs in the browser on the
 * ad copy and the landing page text the user pasted. It never fetches a website and never calls
 * a language model. Everything it produces is labelled as demo analysis.
 *
 * Pure module (no DOM / React / env access) so it can be unit-tested in Node.
 */

import { DIMENSIONS, SCHEMA_VERSION } from '../utils/constants.js';

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have', 'in', 'is', 'it',
  'its', 'of', 'on', 'or', 'our', 'that', 'the', 'their', 'this', 'to', 'was', 'we', 'with', 'you',
  'your', 'all', 'any', 'can', 'get', 'more', 'now', 'out', 'up', 'every', 'only', 'than', 'then',
  'into', 'over', 'new', 'best', 'just', 'one', 'not', 'but', 'who', 'what', 'will', 'been', 'also',
  'each', 'per', 'off', 'about', 'all', 'while', 'when', 'where', 'how',
]);

const UNIT_WORDS = new Set([
  'day', 'days', 'week', 'weeks', 'month', 'months', 'year', 'years', 'hour', 'hours', 'minute',
  'minutes', 'usd', 'inr', 'eur', 'gbp', 'rs',
]);

const stem = (word) => (word.length > 4 ? word.replace(/(ing|ed|es|s)$/, '') : word);

/** Unique content words as [{ stem, word }]. */
export function tokensOf(text = '') {
  const seen = new Set();
  const out = [];
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .forEach((word) => {
      if (word.length < 3 || !/[a-z]/.test(word) || STOPWORDS.has(word)) return;
      const s = stem(word);
      if (!seen.has(s)) {
        seen.add(s);
        out.push({ stem: s, word });
      }
    });
  return out;
}

export function splitSentences(text = '') {
  return String(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[-*•\s]+/, '').trim())
    .filter((s) => s.length > 3);
}

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/* ------------------------------------------------------------------ */
/* Quantities (numbers with units) and counts                          */
/* ------------------------------------------------------------------ */

const num = (s) => Number(String(s).replace(/,/g, ''));

/** Numbers bound to a unit: percent, durations, currency amounts. */
export function quantities(text = '') {
  const t = String(text).toLowerCase();
  const out = [];
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)*)\s?%/g)) out.push({ value: num(m[1]), unit: 'percent' });
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)[\s-]?(day|week|month|year|hour|minute)s?\b/g)) {
    out.push({ value: num(m[1]), unit: m[2] });
  }
  for (const m of t.matchAll(/[$₹€£]\s?(\d[\d,]*(?:\.\d+)?)/g)) out.push({ value: num(m[1]), unit: 'currency' });
  for (const m of t.matchAll(/(\d[\d,]*(?:\.\d+)?)\s?(?:usd|inr|eur|gbp|rs\.?)\b/g)) {
    out.push({ value: num(m[1]), unit: 'currency' });
  }
  return out;
}

/** Plain counts ("10 projects", "4,000 teams") with the words that follow them. */
export function countContexts(text = '') {
  const raw = String(text).toLowerCase().match(/[a-z]+|\d[\d,]*(?:\.\d+)?%?|[$₹€£]/g) || [];
  const out = [];
  raw.forEach((tok, i) => {
    if (!/^\d/.test(tok) || tok.endsWith('%')) return;
    const prev = raw[i - 1];
    const next = raw[i + 1];
    if (prev && /^[$₹€£]$/.test(prev)) return;
    if (next && UNIT_WORDS.has(next.replace(/s$/, '')) || (next && UNIT_WORDS.has(next))) return;
    const ctx = raw
      .slice(i + 1, i + 4)
      .filter((w) => /^[a-z]+$/.test(w) && !STOPWORDS.has(w) && w.length > 2)
      .map(stem);
    out.push({ value: num(tok), ctx: new Set(ctx) });
  });
  return out;
}

const UNIT_LABEL = {
  percent: (v) => `${v}%`,
  currency: (v) => `${v}`,
  count: (v) => `${v}`,
};
function fmtQty(unit, value) {
  if (UNIT_LABEL[unit]) return UNIT_LABEL[unit](value);
  return `${value} ${unit}${value === 1 ? '' : 's'}`;
}

/**
 * Compare numbers in an ad claim with numbers on the page.
 * contradictions: the page states a different figure for the same unit / thing.
 * missing: the page never mentions that kind of figure at all.
 */
export function compareQuantities(claim, content) {
  const claimQ = quantities(claim);
  const pageQ = quantities(content);
  const contradictions = [];
  const missing = [];

  [...new Set(claimQ.map((q) => q.unit))].forEach((unit) => {
    const adVals = [...new Set(claimQ.filter((q) => q.unit === unit).map((q) => q.value))];
    const pageVals = [...new Set(pageQ.filter((q) => q.unit === unit).map((q) => q.value))];
    adVals.forEach((value) => {
      if (pageVals.includes(value)) return;
      if (pageVals.length === 0) missing.push({ unit, value });
      else contradictions.push({ unit, value, pageValues: pageVals });
    });
  });

  const claimC = countContexts(claim);
  const pageC = countContexts(content);
  claimC.forEach((c) => {
    if (c.ctx.size === 0) {
      if (!pageC.some((p) => p.value === c.value)) missing.push({ unit: 'count', value: c.value });
      return;
    }
    const related = pageC.filter((p) => [...c.ctx].some((s) => p.ctx.has(s)));
    if (related.length === 0) missing.push({ unit: 'count', value: c.value });
    else if (!related.some((p) => p.value === c.value)) {
      contradictions.push({ unit: 'count', value: c.value, pageValues: [...new Set(related.map((p) => p.value))] });
    }
  });

  return { contradictions, missing, hasQuantities: claimQ.length + claimC.length > 0 };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Replace the ad's figure with the page's figure inside a claim (best effort). */
function swapFigure(claim, adValue, pageValue) {
  const re = new RegExp(`(?<![\\d.,])${escapeRegExp(String(adValue))}(?![\\d])`);
  const swapped = claim.replace(re, String(pageValue));
  return swapped === claim ? null : swapped;
}

/* ------------------------------------------------------------------ */
/* Offer / CTA / trust patterns                                        */
/* ------------------------------------------------------------------ */

const OFFER_PATTERNS = [
  { key: 'free-trial', label: 'free trial', ad: /free trial/i, page: /free trial|try (it )?free|trial/i },
  { key: 'free-shipping', label: 'free shipping', ad: /free (shipping|delivery)|ships? free/i, page: /free (shipping|delivery)|shipping is free|ships? free|delivery is free/i },
  { key: 'guarantee', label: 'money-back guarantee', ad: /money[- ]back|guarantee/i, page: /money[- ]back|guarantee|refund/i },
  { key: 'no-card', label: 'no credit card required', ad: /no credit card/i, page: /no credit card/i },
  { key: 'discount', label: 'discount', ad: /discount|coupon|\d+\s?% off|\d+\s?%\s?off|sale/i, page: /discount|coupon|\d+\s?% off|\d+\s?%|sale|save/i },
];
const URGENCY = /today only|limited time|hurry|last chance|ends? (soon|today|tonight)|while supplies last|only \d+ left|flash sale|offer ends/i;
const ABSOLUTES = /\b(all|every|any|always|unlimited|guaranteed|never|everyone)\b/i;
const QUALIFIERS = /\b(over|minimum|selected|up to|only on|terms|conditions|excluding|except|starting from|limited to|eligible|subject to)\b/i;

const CTA_VERBS = /\b(get started|sign up|sign-up|buy now|add to cart|start (your )?(free )?(trial|now)|book( a| your)?|subscribe|download|request|contact us|learn more|shop now|try|join|order now|register|claim|apply)\b/i;
const SOCIAL_PROOF = /\b(reviews?|testimonials?|rated|stars?|customers?|trusted by|clients?|users?|teams?|case stud(y|ies))\b/i;
const RISK_REVERSAL = /\b(guarantee|refund|money[- ]back|returns?|cancel anytime|cancel any time|no commitment)\b/i;
const SECURITY_CONTACT = /\b(secure|security|privacy|ssl|encrypted|terms|contact|support|phone|email|address|@)\b/i;

/* ------------------------------------------------------------------ */
/* Claim extraction and evaluation                                     */
/* ------------------------------------------------------------------ */

export function extractClaims(input) {
  const claims = [{ text: input.headline.trim(), source: 'headline' }];
  const seen = new Set([input.headline.trim().toLowerCase()]);
  splitSentences(input.body).forEach((sentence) => {
    const key = sentence.toLowerCase();
    if (seen.has(key)) return;
    if (tokensOf(sentence).length < 2 && quantities(sentence).length === 0) return;
    seen.add(key);
    claims.push({ text: sentence, source: 'body' });
  });
  return claims.slice(0, 8);
}

function buildPage(content) {
  const sentences = splitSentences(content).map((text) => ({
    text,
    stems: new Set(tokensOf(text).map((t) => t.stem)),
  }));
  return {
    content,
    sentences,
    stems: new Set(tokensOf(content).map((t) => t.stem)),
    wordCount: (content.match(/\S+/g) || []).length,
  };
}

function bestSentence(tokens, sentences, filter = () => true) {
  let best = null;
  let bestHits = 0;
  sentences.forEach((s) => {
    if (!filter(s)) return;
    const hits = tokens.filter((t) => s.stems.has(t.stem)).length;
    if (hits > bestHits || (hits === bestHits && hits > 0 && best && s.text.length < best.text.length)) {
      best = s;
      bestHits = hits;
    }
  });
  return { sentence: best, hits: bestHits };
}

const MAX_QUOTE = 420;

function evaluateClaim(claim, page) {
  const tokens = tokensOf(claim.text);
  const missingWords = tokens.filter((t) => !page.stems.has(t.stem)).map((t) => t.word);
  const pageCoverage = tokens.length ? (tokens.length - missingWords.length) / tokens.length : 1;
  const { sentence, hits } = bestSentence(tokens, page.sentences);
  const localCoverage = tokens.length ? hits / tokens.length : 1;
  const q = compareQuantities(claim.text, page.content);
  const base = { claim: claim.text, source: claim.source, quoteSentence: sentence ? sentence.text : null };

  // 1. Contradiction: the page states a different figure for the same thing.
  if (q.contradictions.length) {
    const c = q.contradictions[0];
    const evidenceSentence =
      page.sentences.find((s) => quantities(s.text).some((x) => x.unit === c.unit && c.pageValues.includes(x.value))) ||
      page.sentences.find((s) => countContexts(s.text).some((x) => c.pageValues.includes(x.value))) ||
      sentence;
    const adText = fmtQty(c.unit, c.value);
    const pageText = c.pageValues.map((v) => fmtQty(c.unit, v)).join(', ');
    const replacement = swapFigure(claim.text, c.value, c.pageValues[0]);
    return {
      ...base,
      status: 'contradicted',
      severity: 'high',
      verified: evidenceSentence ? 'found' : 'unable',
      quote: evidenceSentence ? evidenceSentence.text : null,
      finding: 'The landing page states a different figure',
      explanation: `The ad says ${adText}, but the landing page text says ${pageText}.`,
      correction: replacement
        ? `Make the figures match. Either change the ad to “${replacement}” or update the landing page if the ad is correct.`
        : 'Make the figures in the ad and on the landing page match.',
      replacement,
      kind: 'contradictory',
      hasQuantities: true,
    };
  }

  // 2. Figure in the ad that the page never mentions.
  if (q.missing.length) {
    const m = q.missing[0];
    return {
      ...base,
      status: 'missing',
      severity: 'high',
      verified: hits > 0 ? 'partial' : 'not_found',
      quote: hits > 0 && sentence ? sentence.text : null,
      finding: 'A figure from the ad is not on the landing page',
      explanation: `The ad mentions ${fmtQty(m.unit, m.value)}, but no matching figure was found in the landing page text.`,
      correction: 'Show the same figure on the landing page, or remove it from the ad.',
      replacement: claim.text,
      kind: 'missing',
      hasQuantities: true,
    };
  }

  // 3. Absolute ad wording vs a qualified page statement (e.g. "all orders" vs "orders over $75").
  if (sentence && localCoverage >= 0.6 && ABSOLUTES.test(claim.text) && QUALIFIERS.test(sentence.text) && !QUALIFIERS.test(claim.text)) {
    const qualifier = sentence.text.match(QUALIFIERS)[0];
    return {
      ...base,
      status: 'weak',
      severity: 'medium',
      verified: 'partial',
      quote: sentence.text,
      finding: 'The page adds a condition the ad does not mention',
      explanation: `The ad states this without limits, but the page text includes the qualifier “${qualifier}”.`,
      correction: 'State the condition in the ad (for example “free shipping on orders over $75”) so expectations match.',
      replacement: null,
      kind: 'weak',
      hasQuantities: q.hasQuantities,
    };
  }

  // 4. Strong keyword support (all terms present on the page and most of them in one passage).
  if (localCoverage >= 0.7 || (localCoverage >= 0.5 && pageCoverage === 1)) {
    return {
      ...base,
      status: 'supported',
      severity: 'none',
      verified: 'found',
      quote: sentence ? sentence.text : null,
      finding: 'Supported by the landing page',
      explanation: `${hits} of ${tokens.length} key terms from this claim appear together in one passage on the page (keyword match).`,
      correction: '',
      replacement: null,
      kind: null,
      hasQuantities: q.hasQuantities,
    };
  }

  // 5. Partial support.
  if (localCoverage >= 0.4 || pageCoverage >= 0.7) {
    return {
      ...base,
      status: 'weak',
      severity: 'medium',
      verified: sentence ? 'partial' : 'unable',
      quote: sentence ? sentence.text : null,
      finding: 'Only weakly supported',
      explanation: `Some key terms are missing near the closest passage${missingWords.length ? ` (${missingWords.slice(0, 4).join(', ')})` : ''}.`,
      correction: 'Repeat the claim using the same wording near the top of the landing page.',
      replacement: claim.text,
      kind: 'weak',
      hasQuantities: q.hasQuantities,
    };
  }

  // 6. Not found.
  return {
    ...base,
    status: 'missing',
    severity: claim.source === 'headline' ? 'high' : 'medium',
    verified: hits > 0 ? 'partial' : 'not_found',
    quote: hits > 0 && sentence ? sentence.text : null,
    finding: 'No supporting text found',
    explanation: `The landing page text does not appear to cover this claim${missingWords.length ? ` (missing: ${missingWords.slice(0, 5).join(', ')})` : ''}.`,
    correction: 'Add copy that supports this claim, or remove the claim from the ad.',
    replacement: claim.text,
    kind: 'missing',
    hasQuantities: q.hasQuantities,
  };
}

/* ------------------------------------------------------------------ */
/* Main entry                                                          */
/* ------------------------------------------------------------------ */

const BENEFIT = {
  high: 'Estimated impact: high. Removes a direct mismatch that can undermine trust. This is an illustrative estimate, not a measured result.',
  medium: 'Estimated impact: medium. Reduces confusion between the ad and the page. This is an illustrative estimate, not a measured result.',
  low: 'Estimated impact: low to medium. A small polish that supports the main message. This is an illustrative estimate, not a measured result.',
};

const makeId = () => `aud_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const average = (parts) => {
  const usable = parts.filter((p) => p != null);
  return usable.length ? usable.reduce((a, b) => a + b, 0) / usable.length : null;
};

function buildDemoProofGraph(evidence, pageText) {
  const sectionId = 'section-1';
  const nodes = [{
    id: sectionId,
    type: 'section',
    label: 'Landing Page Content',
    text: pageText,
  }];
  const edges = [];

  evidence.forEach((item, index) => {
    const claimId = `claim-${index + 1}`;
    const verified = String(item.verified || 'unable').toLowerCase();
    const quote = typeof item.evidence === 'string' ? item.evidence.trim() : '';
    let status = 'not_found';

    if (verified === 'found' || verified === 'verified') {
      status = 'found';
    } else if (verified === 'partial' || verified === 'partially_supported') {
      status = 'partial';
    } else if (verified === 'unable') {
      status = 'unknown';
    }

    nodes.push({
      id: claimId,
      type: 'claim',
      label: item.claim || `Claim ${index + 1}`,
      status,
    });

    if (!quote || (status !== 'found' && status !== 'partial')) return;

    const evidenceId = `evidence-${index + 1}`;
    nodes.push({
      id: evidenceId,
      type: 'evidence',
      label: clip(quote, 120),
      text: quote,
      status,
    });
    edges.push({
      source: claimId,
      target: evidenceId,
      type: status === 'partial' ? 'partially_supported_by' : 'supported_by',
    });

    if (pageText.includes(quote)) {
      edges.push({
        source: evidenceId,
        target: sectionId,
        type: 'located_in',
      });
    }
  });

  return {
    nodes,
    edges,
    summary: {
      claimCount: nodes.filter((node) => node.type === 'claim').length,
      evidenceCount: nodes.filter((node) => node.type === 'evidence').length,
      sectionCount: nodes.filter((node) => node.type === 'section').length,
      connectionCount: edges.length,
    },
  };
}

export function runDemoAnalysis(input, { now = new Date(), id } = {}) {
  const pageText = (input.pageText || '').trim();
  const page = buildPage(pageText);
  const adText = [input.headline, input.body, input.cta].filter(Boolean).join(' ');

  const claims = extractClaims(input);
  const results = claims.map((c) => evaluateClaim(c, page));

  /* Offer patterns: catch offers the claim-level keyword match could not see. */
  const extraItems = [];
  OFFER_PATTERNS.forEach((p) => {
    if (!p.ad.test(adText) || p.page.test(pageText)) return;
    const carriers = results.filter((r) => p.ad.test(r.claim));
    if (carriers.length) {
      carriers.forEach((r) => {
        if (r.status === 'supported') {
          Object.assign(r, {
            status: 'weak',
            severity: 'medium',
            verified: 'partial',
            finding: 'Offer wording not found on the page',
            explanation: `The ad promotes “${p.label}”, but the landing page text does not mention it.`,
            correction: `Show the “${p.label}” offer clearly on the landing page, or remove it from the ad.`,
            replacement: null,
            kind: 'weak',
            hasQuantities: true,
          });
        }
        r.offer = true;
      });
    } else {
      extraItems.push({
        claim: `Offer in ad: “${p.label}”`,
        source: 'offer',
        status: 'missing',
        severity: 'medium',
        verified: 'not_found',
        quote: null,
        finding: 'Offer not found on the landing page',
        explanation: `The ad promotes “${p.label}”, but the landing page text does not mention it.`,
        correction: `Show the “${p.label}” offer clearly on the landing page, or remove it from the ad.`,
        replacement: null,
        kind: 'missing',
        offer: true,
        hasQuantities: true,
      });
    }
  });

  if (URGENCY.test(adText) && !URGENCY.test(pageText)) {
    const phrase = adText.match(URGENCY)[0];
    extraItems.push({
      claim: `Urgency in ad: “${phrase}”`,
      source: 'offer',
      status: 'weak',
      severity: 'low',
      verified: 'not_found',
      quote: null,
      finding: 'No matching deadline on the landing page',
      explanation: 'The ad creates urgency, but the landing page text shows no deadline, countdown or stock message.',
      correction: 'Add a visible end date or countdown that matches the ad, or remove the urgency wording from the ad.',
      replacement: null,
      kind: 'weak',
      offer: true,
      hasQuantities: false,
    });
  }

  /* CTA alignment */
  let ctaResult = null;
  const pageCtaLines = page.sentences.filter((s) => CTA_VERBS.test(s.text));
  if (input.cta) {
    const ctaNorm = input.cta.toLowerCase().trim();
    const exact = page.sentences.find((s) => s.text.toLowerCase().includes(ctaNorm));
    const ctaTokens = tokensOf(input.cta);
    if (exact) {
      ctaResult = { score: 100, status: 'supported', quote: exact.text };
    } else if (pageCtaLines.length) {
      // The page has call-to-action wording, but not the ad's wording.
      const { sentence, hits } = bestSentence(ctaTokens, pageCtaLines);
      const ratio = ctaTokens.length ? hits / ctaTokens.length : 0;
      if (sentence && ratio >= 0.5) ctaResult = { score: 75, status: 'weak', quote: sentence.text };
      else ctaResult = { score: 40, status: 'weak', quote: (sentence || pageCtaLines[0]).text, different: true };
    } else {
      ctaResult = { score: 20, status: 'missing', quote: null };
    }
  }
  const pageHasCta = CTA_VERBS.test(pageText);

  /* Build evidence list */
  const evidence = [];
  let n = 0;
  const pushEvidence = (r) => {
    n += 1;
    evidence.push({
      id: `e${n}`,
      claim: r.source === 'headline' ? `Headline: ${r.claim}` : r.claim,
      evidence: r.quote ? clip(r.quote, MAX_QUOTE) : null,
      verified: r.verified,
      finding: r.finding,
      severity: r.severity,
      explanation: r.explanation,
      correction: r.correction,
    });
    return `e${n}`;
  };
  const allItems = [...results, ...extraItems];
  allItems.forEach((r) => {
    r.evidenceId = pushEvidence(r);
  });

  if (input.cta && ctaResult) {
    const base = { claim: `Call to action: “${input.cta}”`, source: 'cta' };
    let item;
    if (ctaResult.status === 'supported') {
      item = { ...base, status: 'supported', severity: 'none', verified: 'found', quote: ctaResult.quote, finding: 'The landing page offers the same action', explanation: 'The ad’s call-to-action text appears on the landing page.', correction: '', replacement: null, kind: null };
    } else if (ctaResult.status === 'weak') {
      item = {
        ...base,
        status: 'weak',
        severity: ctaResult.different ? 'medium' : 'low',
        verified: 'partial',
        quote: ctaResult.quote,
        finding: ctaResult.different ? 'The page’s call-to-action differs from the ad' : 'The call-to-action is only similar',
        explanation: ctaResult.different
          ? `The ad asks visitors to “${input.cta}”, but the closest call-to-action found on the page is different.`
          : `The ad asks visitors to “${input.cta}”; the page uses similar but not identical wording.`,
        correction: `Use the same call-to-action wording on the page’s main button: “${input.cta}”.`,
        replacement: input.cta,
        kind: 'weak',
      };
    } else {
      item = { ...base, status: 'missing', severity: 'medium', verified: 'not_found', quote: null, finding: 'No call-to-action found on the page', explanation: `The ad asks visitors to “${input.cta}”, but no call-to-action wording was found in the page text.`, correction: `Add a prominent button or link labelled “${input.cta}”.`, replacement: input.cta, kind: 'missing' };
    }
    item.evidenceId = pushEvidence(item);
    allItems.push(item);
  }

  /* Trust & clarity checks (page level) */
  const checks = [
    { key: 'length', pass: page.wordCount >= 60, kind: 'clarity', severity: 'low', title: 'Landing page text is very short', text: `Only ${page.wordCount} words were provided. Thin pages give visitors little reason to trust the ad’s promises.`, fix: 'Add a short section that explains the offer, who it is for and how it works.' },
    { key: 'headline-length', pass: input.headline.length <= 90, kind: 'clarity', severity: 'low', title: 'The ad headline is long', text: `The headline is ${input.headline.length} characters. Long headlines are harder to mirror on the landing page.`, fix: 'Shorten the headline to one clear promise and reuse the same wording as the page headline.' },
    { key: 'cta', pass: pageHasCta, kind: 'clarity', severity: 'medium', title: 'No clear call-to-action found on the page', text: 'The page text contains no recognisable action wording (such as “Get started”, “Buy now” or “Sign up”).', fix: 'Add one clear primary button that matches the action promised in the ad.' },
    { key: 'proof', pass: SOCIAL_PROOF.test(pageText), kind: 'trust', severity: 'low', title: 'No customer proof found', text: 'No reviews, testimonials, customer counts or case studies were detected in the page text.', fix: 'Add a testimonial, rating or customer logo strip close to the main call-to-action.' },
    { key: 'risk', pass: RISK_REVERSAL.test(pageText), kind: 'trust', severity: 'low', title: 'No risk-reversal wording found', text: 'No guarantee, refund, returns or cancellation wording was detected.', fix: 'State the guarantee, return window or “cancel anytime” promise near the call-to-action.' },
    { key: 'contact', pass: SECURITY_CONTACT.test(pageText), kind: 'trust', severity: 'low', title: 'No security, privacy or contact details found', text: 'The page text mentions no security, privacy, terms or contact information.', fix: 'Link to privacy and terms pages and show a way to contact the business.' },
  ];

  /* Optional context fields */
  const audienceTokens = tokensOf(input.audience || '');
  if (audienceTokens.length) {
    const covered = audienceTokens.filter((t) => page.stems.has(t.stem)).length / audienceTokens.length;
    checks.push({ key: 'audience', pass: covered >= 0.3, kind: 'clarity', severity: 'low', title: 'The page does not speak to the stated audience', text: `Few terms from the target audience (“${input.audience}”) appear in the page text.`, fix: 'Mention the audience in the page headline or first paragraph so visitors know the offer is for them.' });
  }
  if ((input.goal === 'leads' || input.goal === 'signups') && !/\b(form|sign up|sign-up|register|email|subscribe|trial|book|demo|contact)\b/i.test(pageText)) {
    checks.push({ key: 'goal', pass: false, kind: 'clarity', severity: 'medium', title: 'The page shows no sign-up or lead path', text: 'The campaign goal is lead generation or sign-ups, but the page text mentions no form, sign-up or booking step.', fix: 'Add a short form or a clear sign-up button above the fold.' });
  }

  /* Dimensions */
  const supportedWeight = (r) => (r.status === 'supported' ? 1 : r.status === 'weak' ? 0.5 : 0);

  const headlineTokens = tokensOf(input.headline);
  const bodyTokens = tokensOf(input.body);
  const covOf = (tokens) => (tokens.length ? tokens.filter((t) => page.stems.has(t.stem)).length / tokens.length : null);
  const consistency = average([covOf(headlineTokens), covOf(bodyTokens)]);

  const promiseItems = results;
  const promise = promiseItems.length ? promiseItems.reduce((s, r) => s + supportedWeight(r), 0) / promiseItems.length : null;

  const offerItems = allItems.filter((r) => r.hasQuantities || r.offer);
  const offer = offerItems.length ? offerItems.reduce((s, r) => s + supportedWeight(r), 0) / offerItems.length : null;

  const passed = checks.filter((c) => c.pass).length;
  const trust = checks.length ? passed / checks.length : null;

  const dimScores = {
    consistency: consistency == null ? null : Math.round(consistency * 100),
    promise: promise == null ? null : Math.round(promise * 100),
    cta: ctaResult ? ctaResult.score : null,
    offer: offer == null ? null : Math.round(offer * 100),
    trust: trust == null ? null : Math.round(trust * 100),
  };
  const notes = {
    consistency: 'Share of key words from the headline and body that also appear on the page.',
    promise: `${results.filter((r) => r.status === 'supported').length} of ${results.length} ad claims have supporting text; partially supported claims count half.`,
    cta: input.cta ? 'Compares the ad’s call-to-action with action wording found on the page.' : 'Not assessed. Add the ad’s call-to-action to enable this check.',
    offer: offerItems.length ? `${offerItems.length} offer or figure item${offerItems.length === 1 ? '' : 's'} compared (prices, percentages, durations, guarantees, deadlines).` : 'Not assessed. No offers or figures were detected in the ad.',
    trust: `${passed} of ${checks.length} basic page checks passed (length, call-to-action, customer proof, risk reversal, contact details${audienceTokens.length ? ', audience' : ''}).`,
  };
  const dimensions = DIMENSIONS.map((d) => ({ key: d.key, label: d.label, score: dimScores[d.key], note: notes[d.key] }));

  const usable = DIMENSIONS.filter((d) => dimScores[d.key] != null);
  const weightSum = usable.reduce((s, d) => s + d.weight, 0);
  const score = weightSum ? Math.round(usable.reduce((s, d) => s + dimScores[d.key] * d.weight, 0) / weightSum) : 0;

  /* Findings */
  const findings = [];
  let fn = 0;
  allItems.forEach((r) => {
    if (r.status === 'supported' || !r.kind) return;
    fn += 1;
    findings.push({ id: `f${fn}`, kind: r.kind, title: r.finding, text: `${r.claim.replace(/^Headline: /, '')} — ${r.explanation}` });
  });
  checks.filter((c) => !c.pass).forEach((c) => {
    fn += 1;
    findings.push({ id: `f${fn}`, kind: c.kind, title: c.title, text: c.text });
  });

  /* Recommendations */
  const recommendations = [];
  let rn = 0;
  const rank = { high: 0, medium: 1, low: 2 };
  allItems
    .filter((r) => r.severity !== 'none')
    .sort((a, b) => rank[a.severity] - rank[b.severity])
    .forEach((r) => {
      rn += 1;
      recommendations.push({
        id: `r${rn}`,
        title: r.finding,
        explanation: `${r.claim.replace(/^Headline: /, 'Headline: ')} — ${r.explanation}`,
        priority: r.severity,
        fix: r.correction,
        benefit: BENEFIT[r.severity],
        replacement: r.replacement,
      });
    });
  checks.filter((c) => !c.pass).forEach((c) => {
    rn += 1;
    recommendations.push({
      id: `r${rn}`,
      title: c.title,
      explanation: c.text,
      priority: c.severity,
      fix: c.fix,
      benefit: BENEFIT[c.severity],
      replacement: null,
    });
  });
  recommendations.sort((a, b) => rank[a.priority] - rank[b.priority]);
  recommendations.forEach((r, i) => {
    r.id = `r${i + 1}`;
  });

  const counts = {
    supported: allItems.filter((r) => r.status === 'supported').length,
    weak: allItems.filter((r) => r.status === 'weak').length,
    missing: allItems.filter((r) => r.status === 'missing').length,
    contradicted: allItems.filter((r) => r.status === 'contradicted').length,
  };
  const summary = `Demo keyword analysis of ${allItems.length} ad item${allItems.length === 1 ? '' : 's'}: ${counts.supported} supported, ${counts.weak} weakly supported, ${counts.missing} missing and ${counts.contradicted} contradicted. This score is an illustration based on word matching, not a verified AI judgement.`;
  const proofGraph = buildDemoProofGraph(evidence, pageText);

  let hostname = '';
  try {
    hostname = new URL(input.url).hostname.replace(/^www\./, '');
  } catch {
    hostname = '';
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    id: id || makeId(),
    createdAt: now.toISOString(),
    status: 'completed',
    mode: 'demo',
    isSample: false,
    input: {
      headline: input.headline,
      body: input.body,
      cta: input.cta || '',
      url: input.url,
      audience: input.audience || '',
      goal: input.goal || '',
      industry: input.industry || '',
    },
    landingPage: {
      url: input.url,
      hostname,
      contentSource: 'pasted',
      content: pageText,
      wordCount: page.wordCount,
    },
    score,
    dimensions,
    summary,
    findings,
    evidence,
    proofGraph,
    recommendations,
    analysis: {
      engine: 'demo-keyword',
      engineLabel: 'Demo keyword matcher',
      verified: false,
      note: 'Illustrative result produced in your browser by a keyword-matching script. No website was fetched and no AI model was called. The landing page text was pasted by you.',
    },
  };
}

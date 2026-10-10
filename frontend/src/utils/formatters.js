// Small, dependency-free display helpers. No React or DOM imports.

export function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(iso);
}

export function pluralize(count, word, plural = `${word}s`) {
  return `${count} ${count === 1 ? word : plural}`;
}

export function truncate(text = '', max = 80) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url || '—';
  }
}

export function countWords(text = '') {
  const matches = String(text).trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

/** Counts evidence items by severity (supported items are counted under `none`). */
export function countBySeverity(evidence = []) {
  return evidence.reduce(
    (acc, item) => {
      acc[item.severity] = (acc[item.severity] || 0) + 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0, none: 0 },
  );
}

export function getIssues(audit) {
  return (audit.evidence || []).filter((e) => e.severity !== 'none');
}

/** An audit is "high risk" when it scored below 50 or contains at least one high-severity issue. */
export function isHighRisk(audit) {
  if (audit.status !== 'completed') return false;
  return audit.score < 50 || countBySeverity(audit.evidence).high > 0;
}

/** Aggregate numbers for the dashboard. `recStatus` is { [auditId]: { [recId]: true } }. */
export function computeStats(audits = [], recStatus = {}) {
  const total = audits.length;
  const avgScore = total ? Math.round(audits.reduce((sum, a) => sum + a.score, 0) / total) : null;
  const highRisk = audits.filter(isHighRisk).length;
  const improvements = audits.reduce((sum, a) => sum + (a.recommendations || []).length, 0);
  const completed = audits.reduce((sum, a) => {
    const done = recStatus[a.id] || {};
    return sum + (a.recommendations || []).filter((r) => done[r.id]).length;
  }, 0);
  const sampleCount = audits.filter((a) => a.isSample).length;
  return { total, avgScore, highRisk, improvements, completed, pending: improvements - completed, sampleCount };
}

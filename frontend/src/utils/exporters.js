import { getScoreCategory, SEVERITY_LABELS, VERIFY_LABELS } from './constants.js';
import { countBySeverity, formatDateTime } from './formatters.js';

function csvCell(value) {
  let text = String(value ?? '');
  // Neutralise spreadsheet formula injection (cells starting with = + - @).
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

/** CSV of the history table. */
export function auditsToCsv(audits = []) {
  const header = [
    'Created',
    'Status',
    'Mode',
    'Headline',
    'Landing page URL',
    'Score',
    'Category',
    'High',
    'Medium',
    'Low',
    'Recommendations',
  ];
  const rows = audits.map((a) => {
    const sev = countBySeverity(a.evidence);
    return [
      a.createdAt,
      a.status,
      a.isSample ? `${a.mode} (sample)` : a.mode,
      a.input?.headline,
      a.input?.url,
      a.status === 'completed' ? a.score : '',
      a.status === 'completed' ? getScoreCategory(a.score).label : '',
      sev.high,
      sev.medium,
      sev.low,
      (a.recommendations || []).length,
    ];
  });
  return toCsv([header, ...rows]);
}

/** CSV of a single report: evidence rows followed by recommendation rows. */
export function auditReportToCsv(audit, recStatus = {}) {
  const evidenceRows = [
    ['Section', 'Ad claim', 'Landing page evidence', 'Verification', 'Severity', 'Finding', 'Explanation', 'Recommended correction'],
    ...(audit.evidence || []).map((e) => [
      'Evidence',
      e.claim,
      e.evidence ?? '',
      VERIFY_LABELS[e.verified] || e.verified,
      SEVERITY_LABELS[e.severity] || e.severity,
      e.finding,
      e.explanation,
      e.correction,
    ]),
  ];
  const recRows = [
    [],
    ['Section', 'Priority', 'Title', 'Explanation', 'Suggested fix', 'Replacement text', 'Expected benefit (estimate)', 'Completed'],
    ...(audit.recommendations || []).map((r) => [
      'Recommendation',
      r.priority,
      r.title,
      r.explanation,
      r.fix,
      r.replacement ?? '',
      r.benefit,
      recStatus[r.id] ? 'Yes' : 'No',
    ]),
  ];
  return toCsv([...evidenceRows, ...recRows]);
}

/** Plain-text summary used by the "Copy summary" button. */
export function auditToSummaryText(audit) {
  const category = getScoreCategory(audit.score);
  const sev = countBySeverity(audit.evidence);
  const lines = [
    `AdMatch AI audit – ${audit.input.headline}`,
    `Landing page: ${audit.input.url}`,
    `Analysed: ${formatDateTime(audit.createdAt)}`,
    `Analysis type: ${audit.analysis.engineLabel}${audit.analysis.verified ? '' : ' (not verified AI analysis)'}`,
    `Match score: ${audit.score}/100 (${category.label})`,
    `Issues: ${sev.high} high, ${sev.medium} medium, ${sev.low} low`,
    '',
    audit.summary,
  ];
  const top = (audit.recommendations || []).slice(0, 3);
  if (top.length) {
    lines.push('', 'Top recommendations:');
    top.forEach((r, i) => lines.push(`${i + 1}. [${r.priority}] ${r.title} – ${r.fix}`));
  }
  return lines.join('\n');
}

/** Triggers a browser download of a text file. */
export function downloadTextFile(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

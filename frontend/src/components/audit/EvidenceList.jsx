import { useMemo, useState } from 'react';
import { CheckCircle2, Lightbulb, SearchX } from 'lucide-react';
import { SEVERITY_RANK } from '../../utils/constants';
import { SeverityBadge, VerifyBadge } from '../common/Badge';
import EmptyState from '../common/EmptyState';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'issues', label: 'Issues' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'none', label: 'Supported' },
];

const matches = (filter, item) => {
  if (filter === 'all') return true;
  if (filter === 'issues') return item.severity !== 'none';
  return item.severity === filter;
};

/**
 * Evidence cards: the ad claim, the landing page text found for it, the finding,
 * severity, explanation and recommended correction.
 * Never invents quotations: missing evidence is shown as “Evidence not found / Unable to verify”.
 */
export default function EvidenceList({ evidence = [] }) {
  const [filter, setFilter] = useState('issues');

  const sorted = useMemo(
    () => [...evidence].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]),
    [evidence],
  );

  if (evidence.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        tone="success"
        title="No evidence items"
        message="This audit did not produce any claim-level evidence. Older audits and some backend results may not include it."
      />
    );
  }

  const effectiveFilter = FILTERS.find((f) => f.value === filter && evidence.some((e) => matches(f.value, e))) ? filter : 'all';
  const rows = sorted.filter((e) => matches(effectiveFilter, e));

  return (
    <div>
      <div className="filter-chips" role="group" aria-label="Filter evidence">
        {FILTERS.map((f) => {
          const count = evidence.filter((e) => matches(f.value, e)).length;
          return (
            <button
              key={f.value}
              type="button"
              className={`chip-btn ${effectiveFilter === f.value ? 'active' : ''}`}
              onClick={() => setFilter(f.value)}
              aria-pressed={effectiveFilter === f.value}
              disabled={count === 0 && f.value !== 'all'}
            >
              {f.label} <span className="chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      <ul className="evidence-list">
        {rows.map((e) => (
          <li key={e.id}>
            <article className={`evidence-card sev-${e.severity}`}>
              <header className="evidence-head">
                <SeverityBadge severity={e.severity} />
                <VerifyBadge state={e.verified} />
              </header>

              <div className="evidence-cols">
                <div>
                  <h4>Ad claim</h4>
                  <blockquote className="quote quote-ad">{e.claim}</blockquote>
                </div>
                <div>
                  <h4>Landing page evidence</h4>
                  {e.evidence ? (
                    <blockquote className="quote quote-page">“{e.evidence}”</blockquote>
                  ) : (
                    <p className="no-evidence">
                      <SearchX size={16} aria-hidden="true" />
                      {e.verified === 'unable' ? 'Unable to verify' : 'Evidence not found'}
                    </p>
                  )}
                  {e.quoteWarning && <p className="small warn-text">{e.quoteWarning}</p>}
                </div>
              </div>

              <p className="evidence-finding">{e.finding}</p>
              {e.explanation && <p className="muted">{e.explanation}</p>}
              {e.correction && (
                <p className="evidence-fix">
                  <Lightbulb size={16} aria-hidden="true" />
                  <span>
                    <strong>Recommended correction:</strong> {e.correction}
                  </span>
                </p>
              )}
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}

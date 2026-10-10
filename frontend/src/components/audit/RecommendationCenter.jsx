import { useMemo, useState } from 'react';
import { ListChecks, ThumbsUp } from 'lucide-react';
import { useAudit } from '../../hooks/useAudit';
import { SEVERITY_LABELS } from '../../utils/constants';
import { SeverityBadge } from '../common/Badge';
import CopyButton from '../common/CopyButton';
import EmptyState from '../common/EmptyState';

/**
 * Actionable recommendations with priority/status filters and a completion checkbox.
 * Completion state is stored per audit (browser storage) via the audit context.
 */
export default function RecommendationCenter({ audit }) {
  const { recStatus, toggleRecommendation } = useAudit();
  const [priority, setPriority] = useState('all');
  const [status, setStatus] = useState('all');

  const done = recStatus[audit.id] || {};
  const recs = audit.recommendations;
  const completed = recs.filter((r) => done[r.id]).length;

  const rows = useMemo(
    () =>
      recs.filter((r) => {
        if (priority !== 'all' && r.priority !== priority) return false;
        if (status === 'open' && done[r.id]) return false;
        if (status === 'done' && !done[r.id]) return false;
        return true;
      }),
    [recs, priority, status, done],
  );

  if (recs.length === 0) {
    return (
      <EmptyState
        icon={ThumbsUp}
        tone="success"
        title="No recommendations"
        message="Nothing needs fixing based on this analysis. Re-run the audit after you edit the ad or landing page."
      />
    );
  }

  const pct = Math.round((completed / recs.length) * 100);

  return (
    <div>
      <div className="reco-toolbar">
        <div className="reco-progress">
          <div className="reco-progress-text" aria-live="polite">
            <ListChecks size={16} aria-hidden="true" />
            <strong>
              {completed} of {recs.length}
            </strong>{' '}
            completed
          </div>
          <div className="bar" role="progressbar" aria-label="Recommendations completed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span className="bar-fill fill-good" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="reco-filters">
          <label>
            <span className="sr-only">Filter by priority</span>
            <select className="select select-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="all">All priorities</option>
              <option value="high">High priority</option>
              <option value="medium">Medium priority</option>
              <option value="low">Low priority</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by status</span>
            <select className="select select-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="done">Completed</option>
            </select>
          </label>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="muted center-text pad">No recommendations match these filters.</p>
      ) : (
        <ul className="reco-list">
          {rows.map((r) => {
            const isDone = Boolean(done[r.id]);
            const inputId = `rec-${audit.id}-${r.id}`;
            return (
              <li key={r.id} className={`reco-item ${isDone ? 'is-done' : ''}`}>
                <input
                  id={inputId}
                  type="checkbox"
                  className="reco-check"
                  checked={isDone}
                  onChange={() => toggleRecommendation(audit.id, r.id)}
                />
                <div className="reco-body">
                  <label htmlFor={inputId} className="reco-title">
                    {r.title}
                    <span className="sr-only"> ({SEVERITY_LABELS[r.priority]} priority; mark as completed)</span>
                  </label>
                  <div className="reco-meta">
                    <SeverityBadge severity={r.priority} label={`${SEVERITY_LABELS[r.priority]} priority`} />
                    {isDone && <span className="badge badge-done">Completed</span>}
                  </div>
                  {r.explanation && <p className="muted">{r.explanation}</p>}
                  {r.fix && (
                    <p>
                      <strong>Suggested fix:</strong> {r.fix}
                    </p>
                  )}
                  {r.replacement && (
                    <div className="replacement">
                      <div className="replacement-head">
                        <span>Suggested replacement text</span>
                        <CopyButton text={r.replacement} label="Copy text" ariaLabel={`Copy suggested replacement text for ${r.title}`} />
                      </div>
                      <code>{r.replacement}</code>
                    </div>
                  )}
                  {r.benefit && (
                    <p className="benefit">
                      <span className="tag-estimate">Estimate</span> {r.benefit}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

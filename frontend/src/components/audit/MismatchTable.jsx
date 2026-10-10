import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { SEVERITY_ORDER, getSeverityMeta } from '../../utils/formatters';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function SeverityBadge({ severity }) {
  const { label, tone } = getSeverityMeta(severity);
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

export default function MismatchTable({ mismatches = [] }) {
  const [filter, setFilter] = useState('all');

  const rows = useMemo(() => {
    const sorted = [...mismatches].sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    );
    return filter === 'all' ? sorted : sorted.filter((m) => m.severity === filter);
  }, [mismatches, filter]);

  if (mismatches.length === 0) {
    return (
      <div className="empty-state success">
        <CheckCircle2 size={36} />
        <h3>No mismatches found</h3>
        <p className="muted">
          Everything promised in the ad is supported by the landing page text you provided.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="filter-chips" role="group" aria-label="Filter mismatches by severity">
        {FILTERS.map((f) => {
          const count =
            f.value === 'all' ? mismatches.length : mismatches.filter((m) => m.severity === f.value).length;
          return (
            <button
              key={f.value}
              type="button"
              className={`chip-btn ${filter === f.value ? 'active' : ''}`}
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
            >
              {f.label} <span className="chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="muted center-text pad">No {filter}-severity mismatches.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table responsive-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Ad element</th>
                <th>Possible mismatch</th>
                <th>Supporting evidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td data-label="Severity">
                    <SeverityBadge severity={m.severity} />
                    <div className="type-tag">{m.type}</div>
                  </td>
                  <td data-label="Ad element">{m.adElement}</td>
                  <td data-label="Possible mismatch">{m.issue}</td>
                  <td data-label="Supporting evidence">
                    <div className="evidence">{m.evidence}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

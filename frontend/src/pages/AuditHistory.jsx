import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Eye, PlusCircle, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { useAudit } from '../hooks/useAudit';
import { useConfirm } from '../hooks/useConfirm';
import LoadingState from '../components/common/LoadingState';
import ErrorMessage from '../components/common/ErrorMessage';
import EmptyState from '../components/common/EmptyState';
import { ModeBadge, SampleBadge, SeverityBadge, StatusBadge } from '../components/common/Badge';
import { SCORE_CATEGORIES, getScoreCategory } from '../utils/constants';
import { auditsToCsv, downloadTextFile } from '../utils/exporters';
import { countBySeverity, formatDate, getHostname, pluralize, truncate } from '../utils/formatters';

// Failed attempts have no score, so they always sort to the bottom when sorting by score.
const failedLast = (a, b) => (a.status === 'failed') - (b.status === 'failed');

const SORTERS = {
  newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  scoreHigh: (a, b) => failedLast(a, b) || b.score - a.score,
  scoreLow: (a, b) => failedLast(a, b) || a.score - b.score,
};

const DEFAULT_FILTERS = { query: '', category: 'all', status: 'all', severity: 'all', sort: 'newest' };

export default function AuditHistory() {
  const navigate = useNavigate();
  const {
    audits, failed, loading, loadError, refresh, isDemo, setMode, analyzing,
    removeAudit, removeFailed, removeAllAudits, restoreSamples, retryFailed,
  } = useAudit();
  const { confirm, confirmDialog } = useConfirm();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const all = useMemo(() => [...audits, ...failed], [audits, failed]);

  const rows = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return all
      .filter((a) => {
        if (q) {
          const text = `${a.input.headline} ${a.input.body} ${a.input.url} ${a.input.cta} ${a.input.industry}`.toLowerCase();
          if (!text.includes(q)) return false;
        }
        if (filters.status !== 'all' && a.status !== filters.status) return false;
        if (filters.category !== 'all') {
          if (a.status !== 'completed' || getScoreCategory(a.score).key !== filters.category) return false;
        }
        if (filters.severity !== 'all') {
          if (a.status !== 'completed' || countBySeverity(a.evidence)[filters.severity] === 0) return false;
        }
        return true;
      })
      .sort(SORTERS[filters.sort]);
  }, [all, filters]);

  const set = (key) => (event) => setFilters((f) => ({ ...f, [key]: event.target.value }));
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  const handleDelete = async (item) => {
    const ok = await confirm({
      title: item.status === 'failed' ? 'Delete this failed attempt?' : 'Delete this audit?',
      message: `“${truncate(item.input.headline, 80)}” will be permanently removed${item.status === 'completed' ? ' together with its recommendation progress' : ''}.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    if (item.status === 'failed') removeFailed(item.id);
    else await removeAudit(item.id);
  };

  const handleClearAll = async () => {
    const ok = await confirm({
      title: 'Clear all audit history?',
      message: `This permanently deletes ${pluralize(all.length, 'record')}${isDemo ? ' from this browser' : ' from your backend'}. Use “Export CSV” first if you want to keep a copy.${isDemo ? ' You can bring back the built-in sample audits afterwards.' : ''}`,
      confirmLabel: 'Delete everything',
    });
    if (ok) await removeAllAudits();
  };

  const handleRetry = async (item) => {
    const audit = await retryFailed(item.id);
    if (audit) navigate(`/audits/${audit.id}`);
  };

  if (loading) return <LoadingState title="Loading history…" message="Reading your saved audits." />;

  if (loadError) {
    return (
      <div className="stack">
        <ErrorMessage title="Could not load audit history" message={loadError} onRetry={refresh}>
          {!isDemo && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode('demo')}>
              Switch to demo mode
            </button>
          )}
        </ErrorMessage>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="card" aria-label="Search and filters">
        <div className="filters">
          <div className="input-icon search-box">
            <Search size={17} aria-hidden="true" />
            <input type="search" className="input" placeholder="Search headline, ad copy, URL or industry…" value={filters.query} onChange={set('query')} aria-label="Search audits" />
          </div>
          <select className="select" value={filters.category} onChange={set('category')} aria-label="Filter by score category">
            <option value="all">All scores</option>
            {SCORE_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label} ({c.min === 0 ? '<50' : c.key === 'excellent' ? '85+' : c.key === 'good' ? '70–84' : '50–69'})
              </option>
            ))}
          </select>
          <select className="select" value={filters.status} onChange={set('status')} aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <select className="select" value={filters.severity} onChange={set('severity')} aria-label="Filter by severity">
            <option value="all">Any severity</option>
            <option value="high">Has high severity</option>
            <option value="medium">Has medium severity</option>
            <option value="low">Has low severity</option>
          </select>
          <select className="select" value={filters.sort} onChange={set('sort')} aria-label="Sort audits">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="scoreHigh">Score: high to low</option>
            <option value="scoreLow">Score: low to high</option>
          </select>
        </div>

        <div className="filter-foot">
          <span className="muted" role="status">
            Showing {rows.length} of {all.length}
          </span>
          <div className="toolbar-actions">
            {hasFilters && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
                <X size={14} aria-hidden="true" /> Reset filters
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => downloadTextFile('admatch-audit-history.csv', auditsToCsv(rows), 'text/csv')}
              disabled={rows.length === 0}
            >
              <Download size={14} aria-hidden="true" /> Export CSV
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={handleClearAll} disabled={all.length === 0}>
              <Trash2 size={14} aria-hidden="true" /> Clear history
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        {all.length === 0 ? (
          <EmptyState icon={Search} title="No audits saved" message={isDemo ? 'Create a new audit, or restore the built-in sample audits to explore the app.' : 'No audits were returned by the backend yet.'}>
            <Link to="/new" className="btn btn-primary">
              <PlusCircle size={16} aria-hidden="true" /> New audit
            </Link>
            {isDemo && (
              <button type="button" className="btn btn-secondary" onClick={restoreSamples}>
                <RotateCcw size={16} aria-hidden="true" /> Restore samples
              </button>
            )}
          </EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState icon={Search} title="No audits match your filters" message="Try a different search term or reset the filters.">
            <button type="button" className="btn btn-secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
              <X size={16} aria-hidden="true" /> Reset filters
            </button>
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table responsive-table">
              <caption className="sr-only">Saved audits</caption>
              <thead>
                <tr>
                  <th scope="col">Ad headline</th>
                  <th scope="col">Landing page</th>
                  <th scope="col">Score</th>
                  <th scope="col">Status</th>
                  <th scope="col">Issues</th>
                  <th scope="col">Date</th>
                  <th scope="col" className="col-actions">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const done = a.status === 'completed';
                  const sev = countBySeverity(a.evidence);
                  const category = getScoreCategory(a.score);
                  return (
                    <tr key={a.id}>
                      <td data-label="Ad headline">
                        <Link to={`/audits/${a.id}`} className="row-link">
                          {truncate(a.input.headline, 70)}
                        </Link>
                        <div className="badge-row">
                          <ModeBadge mode={a.mode} />
                          {a.isSample && <SampleBadge />}
                        </div>
                      </td>
                      <td data-label="Landing page">{getHostname(a.input.url)}</td>
                      <td data-label="Score">
                        {done ? (
                          <span className={`score-pill score-${category.tone}`} title={category.label}>
                            {a.score} <span className="score-pill-label">{category.label}</span>
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td data-label="Status">
                        <StatusBadge status={a.status} />
                      </td>
                      <td data-label="Issues">
                        {done ? (
                          <div className="badge-row">
                            {sev.high > 0 && <SeverityBadge severity="high" label={`${sev.high} high`} />}
                            {sev.medium > 0 && <SeverityBadge severity="medium" label={`${sev.medium} med`} />}
                            {sev.low > 0 && <SeverityBadge severity="low" label={`${sev.low} low`} />}
                            {sev.high + sev.medium + sev.low === 0 && <span className="muted">None</span>}
                          </div>
                        ) : (
                          <span className="muted small">{truncate(a.error, 50)}</span>
                        )}
                      </td>
                      <td data-label="Date">{formatDate(a.createdAt)}</td>
                      <td data-label="Actions" className="col-actions">
                        <div className="row-actions">
                          <Link to={`/audits/${a.id}`} className="icon-btn" aria-label={`Open report: ${truncate(a.input.headline, 40)}`} title="Open report">
                            <Eye size={17} />
                          </Link>
                          {!done && (
                            <button type="button" className="icon-btn" onClick={() => handleRetry(a)} disabled={analyzing} aria-label={`Retry audit: ${truncate(a.input.headline, 40)}`} title="Retry audit">
                              <RotateCcw size={17} />
                            </button>
                          )}
                          <button type="button" className="icon-btn danger" onClick={() => handleDelete(a)} aria-label={`Delete: ${truncate(a.input.headline, 40)}`} title="Delete">
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {confirmDialog}
    </div>
  );
}

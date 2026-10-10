import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Pencil,
  Printer,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useAudit } from '../hooks/useAudit';
import { useConfirm } from '../hooks/useConfirm';
import LoadingState from '../components/common/LoadingState';
import ErrorMessage from '../components/common/ErrorMessage';
import CopyButton from '../components/common/CopyButton';
import { ModeBadge, SampleBadge, SeverityBadge, StatusBadge } from '../components/common/Badge';
import MatchScore from '../components/audit/MatchScore';
import ScoreBreakdown from '../components/audit/ScoreBreakdown';
import FindingsPanel from '../components/audit/FindingsPanel';
import EvidenceList from '../components/audit/EvidenceList';
import RecommendationCenter from '../components/audit/RecommendationCenter';
import AnalysisNotice from '../components/audit/AnalysisNotice';
import { getScoreCategory, GOALS } from '../utils/constants';
import { auditReportToCsv, auditToSummaryText, downloadTextFile } from '../utils/exporters';
import { countBySeverity, formatDateTime, getHostname } from '../utils/formatters';

const SECTIONS = [
  { id: 'summary', label: 'Summary' },
  { id: 'breakdown', label: 'Score breakdown' },
  { id: 'findings', label: 'Key findings' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'details', label: 'Details' },
];

const CONTENT_SOURCE = {
  pasted: 'Pasted by you. The page was not fetched.',
  fetched: 'Fetched by the backend.',
  none: 'Not provided.',
};

function Detail({ label, children }) {
  if (!children) return null;
  return (
    <div className="detail">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function FailedAttempt({ attempt }) {
  const navigate = useNavigate();
  const { retryFailed, removeFailed, analyzing } = useAudit();
  const { confirm, confirmDialog } = useConfirm();

  const handleRetry = async () => {
    const audit = await retryFailed(attempt.id);
    if (audit) navigate(`/audits/${audit.id}`, { replace: true });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete this failed attempt?',
      message: 'The saved input for this failed audit will be removed.',
      confirmLabel: 'Delete attempt',
    });
    if (ok) {
      removeFailed(attempt.id);
      navigate('/history');
    }
  };

  if (analyzing) return <LoadingState title="Retrying audit…" message="Sending your saved input again." />;

  return (
    <div className="stack narrow">
      <Link to="/history" className="btn btn-ghost btn-sm back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Back to history
      </Link>
      <ErrorMessage title="This audit failed" message={attempt.error}>
        <div className="toolbar-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={handleRetry}>
            <RotateCcw size={14} aria-hidden="true" /> Retry audit
          </button>
          <Link to="/new" state={{ prefill: { ...attempt.input, pageText: attempt.pageText } }} className="btn btn-secondary btn-sm">
            <Pencil size={14} aria-hidden="true" /> Edit and re-run
          </Link>
          <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete}>
            <Trash2 size={14} aria-hidden="true" /> Delete
          </button>
        </div>
      </ErrorMessage>
      <section className="card">
        <h2 className="section-title">Saved input</h2>
        <dl className="details">
          <Detail label="Ad headline">{attempt.input.headline}</Detail>
          <Detail label="Ad body copy">{attempt.input.body}</Detail>
          <Detail label="Landing page URL">{attempt.input.url}</Detail>
          <Detail label="Attempted">{formatDateTime(attempt.createdAt)}</Detail>
          <Detail label="Mode">
            <ModeBadge mode={attempt.mode} />
          </Detail>
        </dl>
      </section>
      {confirmDialog}
    </div>
  );
}

export default function AuditReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { loading, loadError, refresh, findAudit, removeAudit, recStatus, isDemo, setMode } = useAudit();
  const { confirm, confirmDialog } = useConfirm();

  if (loading) return <LoadingState title="Loading report…" message="Fetching your audit." />;

  if (loadError) {
    return (
      <div className="stack narrow">
        <ErrorMessage title="Could not load this report" message={loadError} onRetry={refresh}>
          {!isDemo && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode('demo')}>
              Switch to demo mode
            </button>
          )}
        </ErrorMessage>
      </div>
    );
  }

  const audit = findAudit(id);

  if (!audit) {
    return (
      <div className="stack narrow">
        <ErrorMessage title="Audit not found" message="This audit does not exist in the current mode, or it was deleted. Demo audits and live audits are stored separately.">
          <Link to="/history" className="btn btn-secondary btn-sm">
            <ArrowLeft size={14} aria-hidden="true" /> Back to history
          </Link>
        </ErrorMessage>
      </div>
    );
  }

  if (audit.status === 'failed') return <FailedAttempt attempt={audit} />;

  const category = getScoreCategory(audit.score);
  const severity = countBySeverity(audit.evidence);
  const claims = audit.input.body.split(/\n+/).filter(Boolean);
  const goalLabel = GOALS.find((g) => g.value === audit.input.goal)?.label;
  const lp = audit.landingPage;
  let protocol = '';
  try {
    protocol = new URL(audit.input.url).protocol.replace(':', '').toUpperCase();
  } catch {
    protocol = '';
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete this audit?',
      message: `“${audit.input.headline}” and its recommendation progress will be permanently removed. Export it first if you want a copy.`,
      confirmLabel: 'Delete audit',
    });
    if (!ok) return;
    if (await removeAudit(audit.id)) navigate('/history');
  };

  return (
    <div className="stack report">
      <div className="report-toolbar no-print">
        <Link to="/history" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} aria-hidden="true" /> Back to history
        </Link>
        <div className="toolbar-actions">
          <CopyButton text={auditToSummaryText(audit)} label="Copy summary" copiedLabel="Summary copied" />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Printer size={15} aria-hidden="true" /> Print
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadTextFile(`admatch-audit-${audit.id}.json`, JSON.stringify(audit, null, 2), 'application/json')}>
            <Download size={15} aria-hidden="true" /> JSON
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadTextFile(`admatch-audit-${audit.id}.csv`, auditReportToCsv(audit, recStatus[audit.id] || {}), 'text/csv')}>
            <FileSpreadsheet size={15} aria-hidden="true" /> CSV
          </button>
          <Link to="/new" state={{ prefill: { ...audit.input, pageText: lp.content || '' } }} className="btn btn-secondary btn-sm">
            <Pencil size={15} aria-hidden="true" /> Re-run with edits
          </Link>
          <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete}>
            <Trash2 size={15} aria-hidden="true" /> Delete
          </button>
        </div>
      </div>

      <AnalysisNotice audit={audit} />

      <nav className="section-nav no-print" aria-label="Report sections">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            {s.label}
          </a>
        ))}
      </nav>

      <section className="report-top" id="summary" aria-labelledby="summary-title">
        <div className="card score-card">
          <MatchScore score={audit.score} />
          <p className="muted center-text small">Message-match score</p>
        </div>
        <div className="card summary-card">
          <div className="badge-row">
            <StatusBadge status={audit.status} />
            <ModeBadge mode={audit.mode} />
            {audit.isSample && <SampleBadge />}
          </div>
          <p className="eyebrow">{category.label}</p>
          <h2 className="report-title" id="summary-title">
            {audit.input.headline}
          </h2>
          <a href={audit.input.url} target="_blank" rel="noopener noreferrer" className="link-inline">
            {getHostname(audit.input.url)} <ExternalLink size={14} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <p className="summary-text">{audit.summary}</p>
          <div className="severity-row">
            <SeverityBadge severity="high" label={`${severity.high} High`} />
            <SeverityBadge severity="medium" label={`${severity.medium} Medium`} />
            <SeverityBadge severity="low" label={`${severity.low} Low`} />
            <SeverityBadge severity="none" label={`${severity.none} Supported`} />
          </div>
        </div>
      </section>

      <section className="card" id="breakdown" aria-labelledby="breakdown-title">
        <h2 className="section-title" id="breakdown-title">
          Score breakdown
        </h2>
        <ScoreBreakdown dimensions={audit.dimensions} />
      </section>

      <section className="card" id="findings" aria-labelledby="findings-title">
        <h2 className="section-title" id="findings-title">
          Key findings
        </h2>
        <FindingsPanel findings={audit.findings} />
      </section>

      <section className="card" id="evidence" aria-labelledby="evidence-title">
        <h2 className="section-title" id="evidence-title">
          Evidence and mismatches
        </h2>
        <EvidenceList evidence={audit.evidence} />
      </section>

      <section className="card" id="recommendations" aria-labelledby="reco-title">
        <h2 className="section-title" id="reco-title">
          Recommendation center
        </h2>
        <RecommendationCenter audit={audit} />
      </section>

      <section className="card" id="details" aria-labelledby="details-title">
        <h2 className="section-title" id="details-title">
          Audit details
        </h2>
        <div className="details-grid">
          <div>
            <h3 className="mini-title">Advertisement</h3>
            <dl className="details">
              <Detail label="Headline">{audit.input.headline}</Detail>
              <Detail label="Body copy">
                {claims.length > 1 ? (
                  <ul className="plain-list">
                    {claims.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                ) : (
                  claims[0]
                )}
              </Detail>
              <Detail label="Call-to-action">{audit.input.cta}</Detail>
              <Detail label="Target audience">{audit.input.audience}</Detail>
              <Detail label="Campaign goal">{goalLabel && audit.input.goal ? goalLabel : ''}</Detail>
              <Detail label="Industry">{audit.input.industry}</Detail>
            </dl>
          </div>
          <div>
            <h3 className="mini-title">Landing page</h3>
            <dl className="details">
              <Detail label="URL">
                <span className="break">{audit.input.url}</span>
              </Detail>
              <Detail label="Host">{lp.hostname}</Detail>
              <Detail label="Protocol">{protocol}</Detail>
              <Detail label="Page text source">{CONTENT_SOURCE[lp.contentSource]}</Detail>
              <Detail label="Words analysed">{lp.wordCount ? lp.wordCount.toLocaleString() : ''}</Detail>
            </dl>
            {lp.content && (
              <details className="page-text">
                <summary>Show landing page text used</summary>
                <div className="content-box">{lp.content}</div>
              </details>
            )}
          </div>
          <div>
            <h3 className="mini-title">Analysis status</h3>
            <dl className="details">
              <Detail label="Status">Completed</Detail>
              <Detail label="Analysed">{formatDateTime(audit.createdAt)}</Detail>
              <Detail label="Engine">{audit.analysis.engineLabel}</Detail>
              <Detail label="Verified analysis">{audit.analysis.verified ? 'Yes (reported by backend)' : 'No'}</Detail>
              <Detail label="Audit ID">
                <code className="break">{audit.id}</code>
              </Detail>
            </dl>
          </div>
        </div>
      </section>

      {confirmDialog}
    </div>
  );
}

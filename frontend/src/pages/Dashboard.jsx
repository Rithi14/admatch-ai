import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  ClipboardList,
  Gauge,
  History,
  ListChecks,
  PlusCircle,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useAudit } from '../hooks/useAudit';
import LoadingState from '../components/common/LoadingState';
import ErrorMessage from '../components/common/ErrorMessage';
import EmptyState from '../components/common/EmptyState';
import { ModeBadge, SampleBadge, SeverityBadge } from '../components/common/Badge';
import MatchScore from '../components/audit/MatchScore';
import ScoreDistribution from '../components/dashboard/ScoreDistribution';
import ScoreTrend from '../components/dashboard/ScoreTrend';
import { EXAMPLE_INPUTS, exampleToFormValues } from '../services/demoSamples';
import { getScoreCategory } from '../utils/constants';
import {
  computeStats,
  countBySeverity,
  formatRelativeTime,
  getHostname,
  pluralize,
  truncate,
} from '../utils/formatters';

function StatCard({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className={`card stat-card stat-${tone}`}>
      <div className="stat-icon" aria-hidden="true">
        <Icon size={22} />
      </div>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        <p className="stat-hint">{hint}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { audits, failed, recStatus, loading, loadError, refresh, isDemo, setMode, restoreSamples } = useAudit();

  const sorted = useMemo(() => [...audits].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [audits]);
  const stats = useMemo(() => computeStats(audits, recStatus), [audits, recStatus]);
  const recent = sorted.slice(0, 5);

  if (loading) return <LoadingState title="Loading dashboard…" message="Reading your saved audits." />;

  if (loadError) {
    return (
      <div className="stack">
        <ErrorMessage title="Could not load audits" message={loadError} onRetry={refresh}>
          {!isDemo && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode('demo')}>
              Switch to demo mode
            </button>
          )}
        </ErrorMessage>
      </div>
    );
  }

  const examplePrefill = exampleToFormValues(EXAMPLE_INPUTS[0]);

  return (
    <div className="stack">
      <section className="hero card" aria-labelledby="hero-title">
        <div className="hero-text">
          <span className="chip chip-glow">
            <Sparkles size={14} aria-hidden="true" /> Message match auditor
          </span>
          <h2 id="hero-title">Make every ad click land on a page that keeps the promise.</h2>
          <p>Compare an ad with its landing page, see exactly which claims are supported, and fix the mismatches that cost conversions.</p>
          <div className="hero-actions">
            <Link to="/new" className="btn btn-primary btn-lg">
              <PlusCircle size={18} aria-hidden="true" /> Start a new audit
            </Link>
            <Link to="/history" className="btn btn-secondary btn-lg">
              <History size={17} aria-hidden="true" /> View history
            </Link>
          </div>
        </div>
        {stats.avgScore != null && (
          <div className="hero-score">
            <MatchScore score={stats.avgScore} showLabel={false} />
            <p>Average match score</p>
          </div>
        )}
      </section>

      {failed.length > 0 && (
        <ErrorMessage
          variant="warning"
          title={`${pluralize(failed.length, 'audit')} failed`}
          message="Failed audits are saved in your history. Open them there to retry."
        >
          <Link to="/history" className="btn btn-secondary btn-sm">
            Go to history <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </ErrorMessage>
      )}

      {audits.length === 0 ? (
        <section className="card">
          <EmptyState
            icon={ClipboardList}
            title="Welcome! You have no audits yet"
            message={
              isDemo
                ? 'Run your first audit with the built-in example (no setup needed), or bring your own ad copy and landing page text.'
                : 'Run your first audit. In live mode the backend analyses the landing page for you.'
            }
          >
            <Link to="/new" className="btn btn-primary">
              <PlusCircle size={16} aria-hidden="true" /> Create your first audit
            </Link>
            {isDemo && (
              <>
                <Link to="/new" state={{ prefill: examplePrefill }} className="btn btn-secondary">
                  <Sparkles size={16} aria-hidden="true" /> Start from an example
                </Link>
                <button type="button" className="btn btn-ghost" onClick={restoreSamples}>
                  <RotateCcw size={16} aria-hidden="true" /> Load sample audits
                </button>
              </>
            )}
          </EmptyState>
        </section>
      ) : (
        <>
          <section className="stats-grid" aria-label="Audit statistics">
            <StatCard icon={ClipboardList} label="Total audits" value={stats.total} hint={`${stats.sampleCount} sample · ${stats.total - stats.sampleCount} yours`} tone="cyan" />
            <StatCard
              icon={Gauge}
              label="Average match score"
              value={`${stats.avgScore}/100`}
              hint={getScoreCategory(stats.avgScore).label}
              tone="violet"
            />
            <StatCard icon={ShieldAlert} label="High-risk audits" value={stats.highRisk} hint="Score below 50 or any high-severity issue" tone="rose" />
            <StatCard icon={ListChecks} label="Improvements identified" value={stats.improvements} hint={`${stats.completed} completed · ${stats.pending} open`} tone="green" />
          </section>

          <p className="data-note">
            {isDemo
              ? `Figures are calculated from the ${pluralize(stats.total, 'audit')} saved in this browser (demo mode)${stats.sampleCount ? `, including ${pluralize(stats.sampleCount, 'built-in sample audit')}` : ''}. No customer data is shown.`
              : `Figures are calculated from the ${pluralize(stats.total, 'audit')} returned by your backend.`}
          </p>

          <section className="two-col">
            <div className="card">
              <h2 className="section-title">Score distribution</h2>
              <ScoreDistribution audits={audits} />
            </div>
            <div className="card">
              <h2 className="section-title">Score trend</h2>
              <ScoreTrend audits={audits} />
            </div>
          </section>

          <section className="card" aria-labelledby="recent-title">
            <div className="card-head">
              <h2 className="section-title" id="recent-title">
                Recent audits
              </h2>
              <Link to="/history" className="link-inline">
                See all <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <ul className="recent-list">
              {recent.map((audit) => {
                const sev = countBySeverity(audit.evidence);
                const category = getScoreCategory(audit.score);
                return (
                  <li key={audit.id}>
                    <Link to={`/audits/${audit.id}`} className="recent-item">
                      <MatchScore score={audit.score} size="sm" showLabel={false} />
                      <div className="recent-main">
                        <strong>{truncate(audit.input.headline, 70)}</strong>
                        <span className="muted">
                          {getHostname(audit.input.url)} · {formatRelativeTime(audit.createdAt)} · {category.label}
                        </span>
                      </div>
                      <div className="recent-meta">
                        {audit.isSample && <SampleBadge />}
                        <ModeBadge mode={audit.mode} />
                        {sev.high > 0 ? <SeverityBadge severity="high" label={`${sev.high} high`} /> : <span className="muted">{pluralize(sev.medium + sev.low, 'issue')}</span>}
                      </div>
                      <ChevronRight size={18} className="recent-arrow" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          {stats.highRisk > 0 && (
            <p className="data-note">
              <AlertTriangle size={14} aria-hidden="true" /> {pluralize(stats.highRisk, 'audit')} flagged as high risk. Open them from the list above or filter History by “Has high severity”.
            </p>
          )}
        </>
      )}
    </div>
  );
}

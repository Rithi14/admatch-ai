import { useState } from 'react';
import { CheckCircle2, Database, Download, FlaskConical, Loader2, PlugZap, RotateCcw, Server, Trash2 } from 'lucide-react';
import { useAudit } from '../hooks/useAudit';
import { useConfirm } from '../hooks/useConfirm';
import { useToast } from '../hooks/useToast';
import { checkBackend } from '../services/auditApi';
import { API_BASE_URL, API_TIMEOUT_MS, describeError } from '../services/apiClient';
import ErrorMessage from '../components/common/ErrorMessage';
import { downloadTextFile } from '../utils/exporters';
import { pluralize } from '../utils/formatters';

export default function Settings() {
  const { mode, isDemo, setMode, audits, storagePersistent, restoreSamples, resetRecommendationProgress, resetAllLocalData } = useAudit();
  const { confirm, confirmDialog } = useConfirm();
  const toast = useToast();
  const [test, setTest] = useState({ state: 'idle', message: '' });

  const chooseMode = (next) => {
    if (next === mode) return;
    setMode(next);
    toast.info(next === 'demo' ? 'Demo mode on' : 'Live backend mode on', next === 'demo' ? 'Audits run in your browser with the keyword demo.' : `Audits will be sent to ${API_BASE_URL}.`);
  };

  const runTest = async () => {
    setTest({ state: 'testing', message: '' });
    try {
      await checkBackend();
      setTest({ state: 'ok', message: `Connected to ${API_BASE_URL}.` });
    } catch (err) {
      setTest({ state: 'error', message: describeError(err) });
    }
  };

  const exportAll = () => {
    downloadTextFile(
      `admatch-${mode}-audits.json`,
      JSON.stringify({ exportedAt: new Date().toISOString(), mode, audits }, null, 2),
      'application/json',
    );
  };

  const confirmReset = async (options, action) => {
    if (await confirm(options)) action();
  };

  return (
    <div className="stack narrow">
      <section className="card" aria-labelledby="mode-title">
        <h2 className="section-title" id="mode-title">
          Analysis mode
        </h2>
        <div className="mode-options" role="radiogroup" aria-labelledby="mode-title">
          <label className={`mode-option ${isDemo ? 'selected' : ''}`}>
            <input type="radio" name="mode" value="demo" checked={isDemo} onChange={() => chooseMode('demo')} />
            <FlaskConical size={20} aria-hidden="true" />
            <span>
              <strong>Demo mode</strong>
              <small>Runs a transparent keyword-matching script in your browser on the page text you paste. No website is fetched, no AI model is called, and history is kept in this browser only.</small>
            </span>
          </label>
          <label className={`mode-option ${!isDemo ? 'selected' : ''}`}>
            <input type="radio" name="mode" value="live" checked={!isDemo} onChange={() => chooseMode('live')} />
            <Server size={20} aria-hidden="true" />
            <span>
              <strong>Live backend mode</strong>
              <small>Sends audits to your Python FastAPI backend and shows exactly what it returns. If the backend is unavailable you will see an error, never made-up results.</small>
            </span>
          </label>
        </div>
        <p className="hint">Demo audits and live audits are stored separately and never mixed.</p>
      </section>

      <section className="card" aria-labelledby="backend-title">
        <h2 className="section-title" id="backend-title">
          Backend connection
        </h2>
        <dl className="details">
          <div className="detail">
            <dt>Backend URL</dt>
            <dd>
              <code className="break">{API_BASE_URL}</code>
            </dd>
          </div>
          <div className="detail">
            <dt>Request timeout</dt>
            <dd>{Math.round(API_TIMEOUT_MS / 1000)} seconds</dd>
          </div>
        </dl>
        <p className="hint">These come from <code>VITE_API_BASE_URL</code> and <code>VITE_API_TIMEOUT_MS</code> in your <code>.env</code> file. Restart the dev server after changing them. Never put API keys in frontend variables.</p>
        <div className="toolbar-actions">
          <button type="button" className="btn btn-secondary" onClick={runTest} disabled={test.state === 'testing'}>
            {test.state === 'testing' ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <PlugZap size={16} aria-hidden="true" />} Test connection
          </button>
        </div>
        <div aria-live="polite">
          {test.state === 'ok' && (
            <p className="test-result ok">
              <CheckCircle2 size={16} aria-hidden="true" /> {test.message}
            </p>
          )}
          {test.state === 'error' && <ErrorMessage title="Connection failed" message={test.message} />}
        </div>
      </section>

      <section className="card" aria-labelledby="data-title">
        <h2 className="section-title" id="data-title">
          Data and storage
        </h2>
        {isDemo ? (
          <>
            {!storagePersistent && (
              <ErrorMessage variant="warning" title="Browser storage unavailable" message="Your browser blocked local storage, so demo data will be lost when you close or refresh this page." />
            )}
            <p className="muted">
              Demo audits, recommendation progress and preferences are saved in this browser’s local storage. This is <strong>not</strong> a secure database: it can be cleared by your browser, is not shared between devices and is readable by scripts on this site. Do not paste confidential material into demo mode.
            </p>
            <p>
              <Database size={15} aria-hidden="true" /> {pluralize(audits.length, 'audit')} currently saved.
            </p>
          </>
        ) : (
          <p className="muted">In live mode your audit history is stored by the backend. Only recommendation progress and failed attempts are kept in this browser.</p>
        )}
        <div className="toolbar-actions">
          <button type="button" className="btn btn-secondary" onClick={exportAll} disabled={audits.length === 0}>
            <Download size={16} aria-hidden="true" /> Export all audits (JSON)
          </button>
          {isDemo && (
            <button type="button" className="btn btn-secondary" onClick={restoreSamples}>
              <RotateCcw size={16} aria-hidden="true" /> Restore sample audits
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              confirmReset(
                { title: 'Reset recommendation progress?', message: 'All “completed” checkmarks on recommendations will be cleared. Audits are not deleted.', confirmLabel: 'Reset progress' },
                resetRecommendationProgress,
              )
            }
          >
            <RotateCcw size={16} aria-hidden="true" /> Reset recommendation progress
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() =>
              confirmReset(
                { title: 'Reset all local data?', message: 'This removes saved demo audits, failed attempts, recommendation progress and your mode preference from this browser. Backend data is not affected.', confirmLabel: 'Reset everything' },
                resetAllLocalData,
              )
            }
          >
            <Trash2 size={16} aria-hidden="true" /> Reset all local data
          </button>
        </div>
      </section>

      <section className="card" aria-labelledby="about-title">
        <h2 className="section-title" id="about-title">
          What the demo analysis does (and doesn’t)
        </h2>
        <ul className="plain-list bullets">
          <li>Splits your ad copy into claims and looks for the same words and numbers in the page text you pasted.</li>
          <li>Flags figures that differ (for example 50% vs 20%) and offers or calls-to-action it cannot find.</li>
          <li>Quotes only sentences that really exist in the pasted text, otherwise it shows “Evidence not found”.</li>
          <li>It does <strong>not</strong> understand meaning, synonyms or images, never fetches the URL and never calls an AI model.</li>
        </ul>
      </section>
      {confirmDialog}
    </div>
  );
}

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAudit } from '../hooks/useAudit';
import { API_BASE_URL } from '../services/apiClient';
import AuditForm from '../components/audit/AuditForm';
import LoadingState from '../components/common/LoadingState';
import ErrorMessage from '../components/common/ErrorMessage';

const DEMO_STEPS = [
  'Reading the ad headline and body copy',
  'Splitting the ad into individual claims',
  'Matching claims against the pasted page text',
  'Scoring each dimension',
];
const LIVE_STEPS = [
  'Sending the audit request to the backend',
  'Waiting for the backend analysis',
  'Validating the response',
];

export default function NewAudit() {
  const navigate = useNavigate();
  const location = useLocation();
  const { runAudit, analyzing, submitError, clearSubmitError, isDemo } = useAudit();
  const [lastValues, setLastValues] = useState(location.state?.prefill || null);

  const handleSubmit = async (values) => {
    setLastValues(values);
    const audit = await runAudit(values);
    if (audit) navigate(`/audits/${audit.id}`);
  };

  return (
    <div className="stack narrow">
      {isDemo ? (
        <ErrorMessage
          variant="info"
          title="Demo mode"
          message="Results come from a simple keyword-matching script running in your browser. It does not visit the website and does not call an AI model, so scores and quotes are illustrations only."
        />
      ) : (
        <ErrorMessage
          variant="info"
          title="Live backend mode"
          message={`Audits are sent to ${API_BASE_URL}. The result is only as reliable as that backend.`}
        />
      )}

      {submitError && (
        <ErrorMessage
          title="The audit could not be completed"
          message={submitError}
          onRetry={lastValues ? () => handleSubmit(lastValues) : undefined}
          retryLabel="Retry audit"
          onDismiss={clearSubmitError}
        >
          <p className="small">Your input is kept below and the failed attempt was saved in your history.</p>
          {!isDemo && (
            <Link to="/settings" className="btn btn-ghost btn-sm">
              Check backend settings
            </Link>
          )}
        </ErrorMessage>
      )}

      {analyzing ? (
        <LoadingState
          title="Analysing your ad and landing page…"
          message={isDemo ? 'Running the demo analysis in your browser.' : 'This can take a little while.'}
          steps={isDemo ? DEMO_STEPS : LIVE_STEPS}
        />
      ) : (
        <AuditForm onSubmit={handleSubmit} initialValues={lastValues} requirePageText={isDemo} />
      )}
    </div>
  );
}

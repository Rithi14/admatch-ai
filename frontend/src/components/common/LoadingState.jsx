import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Loading indicator.
 * - `steps`   : optional list of messages that rotate while loading
 * - `compact` : small inline version (used while lists load)
 */
export default function LoadingState({
  title = 'Loading…',
  message = '',
  steps = [],
  compact = false,
}) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (steps.length < 2) return undefined;
    const timer = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    }, 650);
    return () => clearInterval(timer);
  }, [steps]);

  if (compact) {
    return (
      <div className="loading-compact" role="status" aria-live="polite">
        <Loader2 className="spin" size={18} />
        <span>{title}</span>
      </div>
    );
  }

  return (
    <div className="loading-state card" role="status" aria-live="polite">
      <div className="loading-orb">
        <span className="loading-ring" />
        <Loader2 className="spin" size={34} />
      </div>
      <h3>{title}</h3>
      {message && <p className="muted">{message}</p>}
      {steps.length > 0 && (
        <ul className="loading-steps">
          {steps.map((step, i) => (
            <li key={step} className={i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}>
              <span className="dot" />
              {step}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

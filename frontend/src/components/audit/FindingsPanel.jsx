import { AlertTriangle, CheckCircle2, FileQuestion, Lightbulb, Scale, ShieldQuestion } from 'lucide-react';
import { FINDING_KINDS } from '../../utils/constants';

const ICONS = {
  missing: FileQuestion,
  contradictory: Scale,
  weak: AlertTriangle,
  clarity: Lightbulb,
  trust: ShieldQuestion,
};

/** Key findings grouped into the five categories. Empty groups say “None found”. */
export default function FindingsPanel({ findings = [] }) {
  return (
    <div className="findings-grid">
      {FINDING_KINDS.map(({ key, label }) => {
        const items = findings.filter((f) => f.kind === key);
        const Icon = ICONS[key];
        return (
          <section key={key} className={`finding-group ${items.length ? 'has-items' : 'is-empty'}`} aria-label={label}>
            <header className="finding-head">
              <Icon size={18} aria-hidden="true" />
              <h3>{label}</h3>
              <span className="finding-count">{items.length}</span>
            </header>
            {items.length === 0 ? (
              <p className="finding-none">
                <CheckCircle2 size={15} aria-hidden="true" /> None found
              </p>
            ) : (
              <ul>
                {items.map((f) => (
                  <li key={f.id}>
                    <strong>{f.title}</strong>
                    {f.text && <p>{f.text}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

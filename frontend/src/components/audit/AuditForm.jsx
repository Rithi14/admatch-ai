import { useState } from 'react';
import { Link2, RotateCcw, Sparkles, Wand2 } from 'lucide-react';
import { EXAMPLE_INPUTS, exampleToFormValues } from '../../services/demoSamples';
import { GOALS, INDUSTRIES, LIMITS, MIN_PAGE_TEXT } from '../../utils/constants';
import { validateAuditInput } from '../../utils/validators';
import InfoTip from '../common/InfoTip';

const EMPTY = {
  headline: '',
  body: '',
  cta: '',
  url: '',
  pageText: '',
  audience: '',
  goal: '',
  industry: '',
};

const FIELD_ORDER = ['headline', 'body', 'cta', 'url', 'pageText', 'audience', 'goal', 'industry'];

function Counter({ value, max }) {
  const over = value.length > max;
  return (
    <span className={`counter ${over ? 'over' : ''}`} aria-hidden="true">
      {value.length.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
}

/**
 * Audit form.
 * - `requirePageText`: demo mode cannot visit websites, so the landing page text is required.
 * - `initialValues`: used to pre-fill after a failed attempt or "Re-run with edits".
 */
export default function AuditForm({ onSubmit, loading = false, initialValues, requirePageText = false }) {
  const [values, setValues] = useState({ ...EMPTY, ...(initialValues || {}) });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);
  const [exampleKey, setExampleKey] = useState(EXAMPLE_INPUTS[0].key);

  const revalidate = (next) => {
    if (touched) setErrors(validateAuditInput(next, { requirePageText }).errors);
  };

  const update = (field) => (event) => {
    const next = { ...values, [field]: event.target.value };
    setValues(next);
    revalidate(next);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const { errors: found, values: cleaned } = validateAuditInput(values, { requirePageText });
    setErrors(found);
    setTouched(true);
    const firstBad = FIELD_ORDER.find((f) => found[f]);
    if (firstBad) {
      document.getElementById(firstBad)?.focus();
      return;
    }
    onSubmit(cleaned);
  };

  const loadExample = () => {
    const example = EXAMPLE_INPUTS.find((e) => e.key === exampleKey);
    if (!example) return;
    setValues({ ...EMPTY, ...exampleToFormValues(example) });
    setErrors({});
    setTouched(false);
  };

  const reset = () => {
    setValues(EMPTY);
    setErrors({});
    setTouched(false);
  };

  const fieldProps = (name, hintId) => ({
    id: name,
    value: values[name],
    onChange: update(name),
    disabled: loading,
    'aria-invalid': errors[name] ? 'true' : undefined,
    'aria-describedby': [hintId, errors[name] ? `${name}-error` : null].filter(Boolean).join(' ') || undefined,
    className: errors[name] ? 'input has-error' : 'input',
  });

  const err = (name) =>
    errors[name] ? (
      <p className="field-error" id={`${name}-error`} role="alert">
        {errors[name]}
      </p>
    ) : null;

  return (
    <form className="card audit-form" onSubmit={handleSubmit} noValidate>
      <div className="example-bar">
        <div className="example-pick">
          <label htmlFor="example-select">Try an example</label>
          <select id="example-select" className="select select-sm" value={exampleKey} onChange={(e) => setExampleKey(e.target.value)} disabled={loading}>
            {EXAMPLE_INPUTS.map((e) => (
              <option key={e.key} value={e.key}>
                {e.label}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadExample} disabled={loading}>
            <Wand2 size={15} aria-hidden="true" /> Load example
          </button>
        </div>
        <p className="hint">Examples use fictional brands. They fill every field so you can test the app instantly.</p>
      </div>

      <fieldset className="form-section" disabled={loading}>
        <legend className="section-title">
          <span className="step-badge">1</span> Advertisement
        </legend>

        <div className="field">
          <div className="label-row">
            <label htmlFor="headline">Ad headline *</label>
            <Counter value={values.headline} max={LIMITS.headline} />
          </div>
          <input type="text" placeholder="e.g. Get 50% Off Running Shoes – Today Only" {...fieldProps('headline', 'headline-hint')} />
          <p className="hint" id="headline-hint">The main promise people see in the ad.</p>
          {err('headline')}
        </div>

        <div className="field">
          <div className="label-row">
            <label htmlFor="body">Ad body copy *</label>
            <Counter value={values.body} max={LIMITS.body} />
          </div>
          <textarea rows={4} placeholder="Paste the description text of the ad. Each sentence is checked as a separate claim." {...fieldProps('body', 'body-hint')} />
          <p className="hint" id="body-hint">Include offers, prices, guarantees and benefits mentioned in the ad.</p>
          {err('body')}
        </div>

        <div className="field">
          <div className="label-row">
            <label htmlFor="cta">
              Call-to-action text <span className="optional">optional</span>
            </label>
            <Counter value={values.cta} max={LIMITS.cta} />
          </div>
          <input type="text" placeholder="e.g. Shop Now" {...fieldProps('cta', 'cta-hint')} />
          <p className="hint" id="cta-hint">The button label in the ad. Enables the CTA alignment check.</p>
          {err('cta')}
        </div>
      </fieldset>

      <fieldset className="form-section" disabled={loading}>
        <legend className="section-title">
          <span className="step-badge">2</span> Landing page
        </legend>

        <div className="field">
          <label htmlFor="url">Landing page URL *</label>
          <div className="input-icon">
            <Link2 size={17} aria-hidden="true" />
            <input type="url" inputMode="url" autoComplete="off" placeholder="https://www.example.com/offer" {...fieldProps('url', 'url-hint')} />
          </div>
          <p className="hint" id="url-hint">Public http(s) address only. Local, private-network and credential-bearing URLs are rejected.</p>
          {err('url')}
        </div>

        <div className="field">
          <div className="label-row">
            <label htmlFor="pageText">
              Landing page text{' '}
              {requirePageText ? <span className="required-tag">required in demo mode</span> : <span className="optional">optional</span>}
              <InfoTip
                label="Why is page text needed?"
                text={
                  requirePageText
                    ? 'Demo mode cannot visit websites. It compares your ad with the text you paste here.'
                    : 'In live mode the backend fetches the page itself. Paste text only if the page needs a login or cannot be fetched.'
                }
              />
            </label>
            <Counter value={values.pageText} max={LIMITS.pageText} />
          </div>
          <textarea rows={8} placeholder="Open the landing page, select all visible text (headline, benefits, pricing, guarantees, buttons), copy it and paste it here." {...fieldProps('pageText', 'pagetext-hint')} />
          <p className="hint" id="pagetext-hint">
            {requirePageText
              ? `Demo mode never fetches websites, so evidence quotes come only from this text. Minimum ${MIN_PAGE_TEXT} characters.`
              : 'Leave empty to let the backend fetch the page.'}
          </p>
          {err('pageText')}
        </div>
      </fieldset>

      <fieldset className="form-section" disabled={loading}>
        <legend className="section-title">
          <span className="step-badge">3</span> Context <span className="optional">optional</span>
        </legend>
        <div className="field-row">
          <div className="field">
            <div className="label-row">
              <label htmlFor="audience">Target audience</label>
              <Counter value={values.audience} max={LIMITS.audience} />
            </div>
            <input type="text" placeholder="e.g. Recreational runners" {...fieldProps('audience')} />
            {err('audience')}
          </div>
          <div className="field">
            <label htmlFor="goal">Campaign goal</label>
            <select {...fieldProps('goal')} className={errors.goal ? 'select has-error' : 'select'}>
              {GOALS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
            {err('goal')}
          </div>
          <div className="field">
            <label htmlFor="industry">Industry or category</label>
            <input type="text" list="industry-options" placeholder="e.g. E-commerce" {...fieldProps('industry')} />
            <datalist id="industry-options">
              {INDUSTRIES.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
            {err('industry')}
          </div>
        </div>
      </fieldset>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={reset} disabled={loading}>
          <RotateCcw size={16} aria-hidden="true" /> Reset form
        </button>
        <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
          <Sparkles size={18} aria-hidden="true" /> {loading ? 'Analysing…' : requirePageText ? 'Run demo audit' : 'Run audit'}
        </button>
      </div>
    </form>
  );
}

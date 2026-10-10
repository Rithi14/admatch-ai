import { DIMENSIONS, getScoreCategory } from '../../utils/constants';
import InfoTip from '../common/InfoTip';

const HELP = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d.help]));

/** Bars for each scoring dimension. Dimensions that could not be assessed say so. */
export default function ScoreBreakdown({ dimensions = [] }) {
  if (dimensions.length === 0) {
    return <p className="muted">No score breakdown is available for this audit (it was created by an earlier version of the app).</p>;
  }
  return (
    <ul className="breakdown">
      {dimensions.map((d) => {
        const assessed = d.score != null;
        const { tone, label } = assessed ? getScoreCategory(d.score) : { tone: 'none', label: 'Not assessed' };
        return (
          <li key={d.key} className="breakdown-row">
            <div className="breakdown-head">
              <span className="breakdown-label">
                {d.label}
                {HELP[d.key] && <InfoTip text={HELP[d.key]} label={`About ${d.label}`} />}
              </span>
              <span className={`breakdown-score tone-${tone}`}>{assessed ? `${d.score}` : '—'}</span>
            </div>
            <div
              className="bar"
              role="meter"
              aria-label={d.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={assessed ? d.score : undefined}
              aria-valuetext={assessed ? `${d.score} out of 100, ${label}` : 'Not assessed'}
            >
              <span className={`bar-fill fill-${tone}`} style={{ width: assessed ? `${Math.max(d.score, 2)}%` : '0%' }} />
            </div>
            <p className="breakdown-note">{d.note}</p>
          </li>
        );
      })}
    </ul>
  );
}

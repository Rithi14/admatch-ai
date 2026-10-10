import { SCORE_CATEGORIES } from '../../utils/constants';

/** Horizontal bars: how many audits fall into each score category. */
export default function ScoreDistribution({ audits = [] }) {
  const counts = SCORE_CATEGORIES.map((c, index) => {
    const upper = index === 0 ? 101 : SCORE_CATEGORIES[index - 1].min;
    return { ...c, upper, count: audits.filter((a) => a.score >= c.min && a.score < upper).length };
  });
  const max = Math.max(1, ...counts.map((c) => c.count));

  return (
    <ul className="dist" aria-label="Number of audits per score category">
      {counts.map((c) => (
        <li key={c.key} className="dist-row">
          <span className="dist-label">
            {c.label}
            <small>
              {c.min === 0 ? `below ${c.upper}` : c.upper > 100 ? `${c.min}–100` : `${c.min}–${c.upper - 1}`}
            </small>
          </span>
          <span className="dist-track" aria-hidden="true">
            <span className={`dist-fill fill-${c.tone}`} style={{ width: `${(c.count / max) * 100}%` }} />
          </span>
          <span className="dist-count">
            {c.count}
            <span className="sr-only"> {c.count === 1 ? 'audit' : 'audits'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

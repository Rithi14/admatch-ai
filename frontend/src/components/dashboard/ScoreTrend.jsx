
import { formatDate } from '../../utils/formatters';

const W = 420;
const H = 190;
const PAD = { top: 14, right: 16, bottom: 26, left: 34 };

/** Line chart of the most recent audit scores (oldest → newest). Pure SVG, no chart library. */
export default function ScoreTrend({ audits = [], limit = 10 }) {
  const points = [...audits]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-limit);

  if (points.length < 2) {
    return <p className="muted trend-empty">Run at least two audits to see how your scores change over time.</p>;
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (i / (points.length - 1)) * innerW;
  const y = (score) => PAD.top + (1 - score / 100) * innerH;
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');
  const area = `${PAD.left},${y(0)} ${line} ${x(points.length - 1)},${y(0)}`;
  const summary = `Line chart of the last ${points.length} audit scores, from ${points[0].score} to ${points[points.length - 1].score}.`;

  return (
    <figure className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="trend-svg">
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="trend-stop-a" />
            <stop offset="100%" className="trend-stop-b" />
          </linearGradient>
        </defs>
        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="trend-grid" />
            <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className="trend-axis">
              {tick}
            </text>
          </g>
        ))}
        <polygon points={area} fill="url(#trend-fill)" />
        <polyline points={line} className="trend-line" fill="none" />
        {points.map((p, i) => (
          <circle key={p.id} cx={x(i)} cy={y(p.score)} r="4.5" className="trend-dot">
            <title>{`${formatDate(p.createdAt)}: ${p.score}/100`}</title>
          </circle>
        ))}
        <text x={PAD.left} y={H - 6} className="trend-axis">
          {formatDate(points[0].createdAt)}
        </text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" className="trend-axis">
          {formatDate(points[points.length - 1].createdAt)}
        </text>
      </svg>
      <table className="sr-only">
        <caption>Audit scores over time</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.id}>
              <td>{formatDate(p.createdAt)}</td>
              <td>{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

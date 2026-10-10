import { useEffect, useId, useState } from 'react';
import { getScoreCategory } from '../../utils/constants';

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Animated circular match score (0-100).
 * size: 'md' (default) | 'sm'
 */
export default function MatchScore({ score = 0, size = 'md', showLabel = true }) {
  const gradientId = useId().replace(/:/g, '');
  const safeScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const [animated, setAnimated] = useState(0);
  const { label, tone } = getScoreCategory(safeScore);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof requestAnimationFrame !== 'function') {
      setAnimated(safeScore);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const duration = 900;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setAnimated(Math.round(safeScore * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [safeScore]);

  const offset = CIRCUMFERENCE * (1 - animated / 100);

  return (
    <div className={`match-score match-score-${size} tone-${tone}`}>
      <div className="match-ring" role="img" aria-label={`Match score ${safeScore} out of 100, ${label}`}>
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" className="grad-start" />
              <stop offset="100%" className="grad-end" />
            </linearGradient>
          </defs>
          <circle className="ring-track" cx="60" cy="60" r={RADIUS} />
          <circle
            className="ring-value"
            cx="60"
            cy="60"
            r={RADIUS}
            stroke={`url(#${gradientId})`}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="match-number" aria-hidden="true">
          <span className="match-value">{animated}</span>
          <span className="match-max">/ 100</span>
        </div>
      </div>
      {showLabel && <span className={`score-pill score-${tone}`}>{label}</span>}
    </div>
  );
}

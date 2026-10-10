/** Friendly empty / zero-data state with an optional action area. */
export default function EmptyState({ icon: Icon, title, message, tone = 'neutral', children }) {
  return (
    <div className={`empty-state empty-${tone}`}>
      {Icon && (
        <div className="empty-icon" aria-hidden="true">
          <Icon size={30} />
        </div>
      )}
      <h3>{title}</h3>
      {message && <p className="muted">{message}</p>}
      {children && <div className="empty-actions">{children}</div>}
    </div>
  );
}

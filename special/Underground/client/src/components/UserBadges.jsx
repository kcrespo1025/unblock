export default function UserBadges({ badges, size = 16, className = '' }) {
  if (!badges || badges.length === 0) return null
  return (
    <span className={`ud-badges ${className}`}>
      {badges.map((b) => (
        <span key={b.id || b.name} className="ud-badge" style={b.color ? { color: b.color } : undefined}>
          <span className="ud-badge-tip">
            <span className="tip-name">{b.name}</span>
            {b.hint && <span className="tip-hint">{b.hint}</span>}
          </span>
          <span className="ud-badge-icon" style={{ fontSize: size }}>{b.icon}</span>
        </span>
      ))}
    </span>
  )
}

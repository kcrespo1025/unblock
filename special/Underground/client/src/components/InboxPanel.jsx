import { useEffect, useMemo, useRef } from 'react'
import Avatar from './Avatar.jsx'
import { formatRelative } from '../format.jsx'

export default function InboxPanel({ notifications, seen, onJump, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  const grouped = useMemo(() => {
    const map = {}
    for (const n of notifications) {
      const key = n.target.type === 'dm' ? `dm:${n.target.id}` : `${n.target.serverId}:${n.target.id}`
      if (!map[key]) map[key] = []
      map[key].push(n)
    }
    return Object.entries(map)
  }, [notifications])

  return (
    <div className="inbox-panel" ref={ref}>
      <div className="inbox-header">
        <span className="inbox-title">Inbox</span>
        <span className="inbox-sub">{notifications.length} {notifications.length === 1 ? 'notification' : 'notifications'}</span>
      </div>
      <div className="inbox-list">
        {grouped.length === 0 && <div className="inbox-empty">No notifications yet — mentions and replies to you will show up here.</div>}
        {grouped.map(([key, items]) => (
          <div key={key} className="inbox-group">
            {items.map((n) => (
              <button
                key={n.id}
                className={`inbox-item ${seen.has(n.id) ? 'seen' : ''}`}
                onClick={() => onJump(n)}
              >
                <span className="inbox-unread-dot">{seen.has(n.id) ? '' : '•'}</span>
                <Avatar user={n.author} size={40} />
                <div className="inbox-body">
                  <div className="inbox-head">
                    <span className="inbox-author" style={{ color: n.author.color || '#fff' }}>{n.author.username}</span>
                    <span className="inbox-time">{formatRelative(n.createdAt)}</span>
                  </div>
                  <div className="inbox-content">{n.content}</div>
                  <div className="inbox-tags">
                    {n.isMention && <span className="inbox-tag">@mention</span>}
                    {n.isReply && <span className="inbox-tag">reply</span>}
                    {n.target.type === 'dm' && <span className="inbox-tag">DM</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

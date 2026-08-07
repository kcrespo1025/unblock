import { useState } from 'react'
import Avatar from './Avatar.jsx'
import ContextMenu from './ContextMenu.jsx'
import ProfilePopout from './ProfilePopout.jsx'
import UserBadges from './UserBadges.jsx'
import { formatRelative, formatFullDate, renderMarkdown, renderInline, CustomEmoji, EMOJIS } from '../format.jsx'
import { PinIcon, FileTextIcon, GearIcon } from '../icons.jsx'

export default function Message({
  message,
  grouped,
  showDay,
  me,
  usernames,
  role,
  friendState,
  customEmoji,
  onReact,
  onEdit,
  onDelete,
  onPin,
  onReply,
  onOpenProfile,
  onAddFriend,
  onOpenDm,
  onCreateThread,
  onOpenThread,
  highlight
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)
  const [menu, setMenu] = useState(null)
  const [profile, setProfile] = useState(false)
  const [popoutX, setPopoutX] = useState(0)
  const [popoutY, setPopoutY] = useState(0)
  const [reactionsOpen, setReactionsOpen] = useState(false)

  const isSystem = !!message.author.system
  const mine = message.author.id === me.id

  if (isSystem) {
    return (
      <>
        {showDay && <div className="day-divider"><span>{showDay}</span><span className="line" /></div>}
        <div className="message">
          <div className="message-body">
            <div className="msg-content msg-system" style={{ padding: '2px 0' }}>
              — <strong>{message.author.username}</strong> {renderInline(message.content, usernames)}
            </div>
          </div>
        </div>
      </>
    )
  }

  const openMenu = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setReactionsOpen(false)
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const openProfile = (e) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    const r = e?.currentTarget?.getBoundingClientRect?.() || {}
    setPopoutX(r.left ?? 100)
    setPopoutY(r.top ?? 100)
    setProfile(true)
  }

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
    } catch { /* noop */ }
  }

  const copyLink = async () => {
    try {
      const path = message.replyTo?.channelId || ''
      await navigator.clipboard.writeText(`${window.location.origin}/channels/${path}/${message.id}`)
    } catch { /* noop */ }
  }

  const saveEdit = () => {
    onEdit(message.id, draft)
    setEditing(false)
  }

  const menuItems = [
    ...(onCreateThread ? [
      { label: 'Create Thread', onClick: () => onCreateThread(message), hint: 'T' },
      'divider'
    ] : []),
    { label: 'Add Reaction', onClick: () => setReactionsOpen(true), hint: 'Emoji' },
    { label: 'Reply', onClick: () => onReply(message), hint: 'R' },
    'divider',
    { label: 'Copy Text', onClick: copyText, hint: 'Ctrl+C' },
    { label: 'Copy Message Link', onClick: copyLink },
    'divider',
    { label: message.pinned ? 'Unpin Message' : 'Pin Message', onClick: () => onPin(message.id) },
    'divider'
  ]
  if (mine) {
    menuItems.push({ label: 'Edit', onClick: () => setEditing(true), hint: 'E' })
    menuItems.push({ label: 'Delete', onClick: () => onDelete(message.id), danger: true })
  }

  const attachment = message.attachment
  const isImage = attachment && attachment.type && attachment.type.startsWith('image/')

  return (
    <>
      {showDay && <div className="day-divider"><span>{showDay}</span><span className="line" /></div>}
      <div className={`message ${grouped ? 'grouped' : ''} ${highlight ? 'highlight' : ''}`} id={`msg-${message.id}`} onContextMenu={openMenu}>
        {!grouped && (
          <div className="avatar-wrap" onClick={openProfile} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation() }}>
            <Avatar user={message.author} size={40} showStatus />
          </div>
        )}
        <div className="message-body">
          {!grouped && (
            <div className="message-head">
              <span className="msg-username" style={{ color: role?.color || message.author.color || '#fff' }} onClick={openProfile}>
                {message.author.username}
                {message.author.title && (
                  <span
                    className="msg-role-badge dev-badge"
                    style={{ color: message.author.title.color || '#ffd700' }}
                  >
                    {message.author.title.icon || <GearIcon size={12} />} {message.author.title.name}
                  </span>
                )}
                <UserBadges badges={message.author.badges} size={14} />
                {!message.author.title && role && role.name !== 'Member' && <span className="msg-role-badge">{role.name}</span>}
              </span>
              <span className="msg-time" title={formatFullDate(message.createdAt)}>
                {formatRelative(message.createdAt)}
              </span>
              {message.pinned && <span className="pinned-flag"><PinIcon size={14} /></span>}
              {message.pending && (
                <span className={`msg-time msg-pending ${message.offline ? 'offline' : ''}`}>
                  {message.offline ? '⚡ queued — will sync' : '⏳ sending…'}
                </span>
              )}
            </div>
          )}

          {message.replyTo && (
            <div className="reply-quote">
              <span className="reply-line" />
              <span className="reply-author" style={{ color: replyColor(message.replyTo.authorId) }}>{message.replyTo.authorName}</span>
              <span className="reply-content">{message.replyTo.content}</span>
            </div>
          )}

          <div className="msg-content">
            {editing ? (
              <input
                style={{ background: 'var(--bg-input)', border: '1px solid #232428', borderRadius: 4, padding: '6px 8px', width: '100%' }}
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit()
                  if (e.key === 'Escape') setEditing(false)
                }}
              />
            ) : (
              <>
                {message.content ? renderMarkdown(message.content, usernames, customEmoji) : null}
                {message.sticker && (
                  <div className="sticker-msg">
                    <span className="sticker-msg-emoji">{message.sticker.emoji}</span>
                    <span className="sticker-msg-name">:{message.sticker.name}:</span>
                  </div>
                )}
                {attachment && (
                  <div className="attachment">
                    {isImage ? (
                      <a href={attachment.dataUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        <img className="attachment-img" src={attachment.dataUrl} alt={attachment.name} />
                      </a>
                    ) : (
                      <a className="attachment-file" href={attachment.dataUrl} download={attachment.name}>
                        <span className="attachment-icon"><FileTextIcon size={18} /></span>
                        <span className="attachment-meta">
                          <span className="attachment-name">{attachment.name}</span>
                          <span className="attachment-size">{formatBytes(attachment.size)}</span>
                        </span>
                      </a>
                    )}
                  </div>
                )}
                {message.edited && !message.pending && <span className="edited">(edited)</span>}
              </>
            )}
          </div>

          {Object.keys(message.reactions || {}).length > 0 && (
            <div className="reactions">
              {Object.entries(message.reactions).map(([emoji, userIds]) => {
                const mineReaction = userIds.includes(me.id)
                const custom = /^:[A-Za-z0-9_+]{2,6}:$/.test(emoji) && customEmoji
                  ? customEmoji[emoji.slice(1, -1).toLowerCase()]
                  : null
                return (
                  <button
                    key={emoji}
                    className={`reaction ${mineReaction ? 'mine' : ''}`}
                    onClick={() => onReact(message.id, emoji)}
                    title={`${userIds.length} reaction${userIds.length > 1 ? 's' : ''}`}
                  >
                    <span>{custom ? <CustomEmoji emoji={custom} /> : emoji}</span>
                    <span className="count">{userIds.length}</span>
                  </button>
                )
              })}
            </div>
          )}

          {message.thread && onOpenThread && (
            <button
              className="thread-chip"
              onClick={(e) => { e.stopPropagation(); onOpenThread(message.thread.id) }}
              title={`Open thread: ${message.thread.name}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 14h-2v-6h2v6zm-1-8.2a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z"/></svg>
              <span className="thread-chip-name">{message.thread.name}</span>
              <span className="thread-chip-count">{message.thread.messageCount} messages</span>
              <span className="thread-chip-open">→</span>
            </button>
          )}
        </div>

        <div className="hover-actions">
          <button className="ha-icon" title="Add Reaction" onClick={(e) => { e.stopPropagation(); setReactionsOpen((v) => !v) }}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-3.5 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-3.5 8.5c-2.6 0-4.8-1.6-5.7-4h11.4c-.9 2.4-3.1 4-5.7 4z"/></svg>
          </button>
          <button className="ha-icon" title="Reply" onClick={(e) => { e.stopPropagation(); onReply(message) }}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
          </button>
          <button className="ha-icon" title="More" onClick={openMenu}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>
          </button>
        </div>

        {reactionsOpen && (
          <div className="reaction-picker" onMouseDown={(e) => e.stopPropagation()}>
            <div className="reaction-picker-title">Reactions</div>
            <div className="reaction-picker-grid">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  className={`rp-cell ${(message.reactions && message.reactions[e] && message.reactions[e].includes(me.id)) ? 'mine' : ''}`}
                  onClick={() => { onReact(message.id, e); setReactionsOpen(false) }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}
      {profile && (
        <div className="popout-layer" onMouseDown={(e) => e.target === e.currentTarget && setProfile(false)}>
          <div style={{ position: 'absolute', left: Math.min(popoutX, window.innerWidth - 340), top: popoutY + 8 }}>
            <ProfilePopout
              user={message.author}
              isMe={mine}
              role={role && role.name !== 'Member' ? role : null}
              onClose={() => setProfile(false)}
              onDm={() => { setProfile(false); onOpenDm && onOpenDm(message.author) }}
              onAddFriend={() => { setProfile(false); onAddFriend && onAddFriend(message.author) }}
              friendState={friendState}
            />
          </div>
        </div>
      )}
    </>
  )
}

function replyColor(authorId) {
  return authorId === 'system' ? '#4e5058' : '#5865f2'
}

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

import Avatar from './Avatar.jsx'
import { renderMarkdown, formatFullDate } from '../format.jsx'
import { PinIcon, CloseIcon, ArrowDownRightIcon } from '../icons.jsx'

export default function PinsDrawer({ messages, onClose, onJump, onRemovePin }) {
  return (
    <div className="pins-drawer">
      <div className="pins-header">
        <span><PinIcon size={18} /> Pinned Messages</span>
        <button className="pins-close" onClick={onClose}><CloseIcon size={16} /></button>
      </div>
      <div className="pins-list">
        {messages.length === 0 && <div className="pins-empty">No pinned messages in this channel.</div>}
        {messages.map((m) => (
          <div className="pin-item" key={m.id}>
            <div className="pin-top">
              <Avatar user={m.author} size={24} />
              <span className="pin-author" style={{ color: m.author.color }}>{m.author.username}</span>
              <span className="pin-time">{formatFullDate(m.createdAt)}</span>
              <button className="pin-jump" onClick={() => onJump(m.id)} title="Jump to message"><ArrowDownRightIcon size={16} /></button>
              <button className="pin-unpin" onClick={() => onRemovePin(m.id)} title="Unpin"><PinIcon size={16} /></button>
            </div>
            <div className="pin-content">{renderMarkdown(m.content, [])}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

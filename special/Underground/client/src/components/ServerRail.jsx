import { isImageDataUrl, isHttpUrl } from '../media.js'
import { DiscordLogoIcon, BellIcon } from '../icons.jsx'

function IconMedia({ src }) {
  if (!src) return null
  if (isImageDataUrl(src) || isHttpUrl(src)) {
    return <img className="rail-media" src={src} alt="" draggable={false} />
  }
  return <video className="rail-media" src={src} muted loop autoPlay playsInline />
}

export default function ServerRail({ servers, current, onSelect, onHome, onAddServer, onInbox, inboxUnread, inboxOpen }) {
  return (
    <div className="rail">
      <button className={`rail-home ${!current ? 'active' : ''}`} title="Direct Messages" onClick={onHome}>
        <DiscordLogoIcon size={26} />
      </button>
      <button
        className={`rail-inbox ${inboxOpen ? 'active' : ''}`}
        title="Inbox (notifications)"
        onClick={onInbox}
      >
        <BellIcon size={22} />
        {inboxUnread > 0 && <span className="rail-badge">{inboxUnread > 9 ? '9+' : inboxUnread}</span>}
      </button>
      <div className="rail-divider" />
      {servers.map((s) => (
        <button
          key={s.id}
          className={`rail-icon ${current?.serverId === s.id ? 'active' : ''}`}
          title={s.name}
          onClick={() => onSelect(s.id)}
        >
          <span className="pill" />
          {s.iconMedia ? <IconMedia src={s.iconMedia} /> : <span className="icon-text">{s.icon}</span>}
        </button>
      ))}
      <button className="rail-add" title="Add a Server" onClick={onAddServer}>
        +
      </button>
    </div>
  )
}

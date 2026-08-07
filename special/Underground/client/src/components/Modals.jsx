import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import Avatar from './Avatar.jsx'
import { api } from '../api.js'
import { pickMediaFile, isImageDataUrl, isHttpUrl } from '../media.js'
import { MessageIcon, VolumeIcon, UploadIcon, CloseIcon } from '../icons.jsx'

const ICONS = ['🌐', '🎮', '🎵', '📚', '🏀', '🍕', '🐱', '🔥', '🎬', '🌙', '⚡', '💎', '🌿', '🚀', '🌈', '🎲']

export function CreateServerModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(ICONS[0])
  const [iconMedia, setIconMedia] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const uploadIcon = async () => {
    setError('')
    try {
      const media = await pickMediaFile({ maxDim: 256 })
      if (media) setIconMedia(media.dataUrl)
    } catch (err) {
      setError(err.message)
    }
  }

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      const data = await api('/servers', { method: 'POST', body: { name, icon, iconMedia } })
      onCreated(data.server)
    } catch (err) {
      if (err.auth) return
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Create Your Server"
      subtitle="Give your new server a personality with a name and an icon."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || name.trim().length < 2}>
            Create Server
          </button>
        </>
      }
    >
      {error && <div className="auth-error">{error}</div>}
      <div className="server-icon-row">
        <div className="server-icon-preview">
          {iconMedia ? (
            isImageDataUrl(iconMedia) || isHttpUrl(iconMedia) ? (
              <img className="server-icon-img" src={iconMedia} alt="" />
            ) : (
              <video className="server-icon-img" src={iconMedia} muted loop autoPlay playsInline />
            )
          ) : (
            <span>{icon}</span>
          )}
        </div>
        <button className="btn btn-ghost" onClick={uploadIcon} disabled={busy}><UploadIcon size={16} /> Upload Image / Clip</button>
        {iconMedia && <button className="btn btn-ghost" onClick={() => setIconMedia(null)}><CloseIcon size={16} /></button>}
      </div>
      <div className="icon-grid">
        {ICONS.map((i) => (
          <button key={i} className={`icon-option ${icon === i ? 'selected' : ''}`} onClick={() => setIcon(i)}>
            {i}
          </button>
        ))}
      </div>
      <div className="form-field">
        <label>Server Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Cool Server"
          autoFocus
          maxLength={32}
        />
      </div>
    </Modal>
  )
}

export function CreateChannelModal({ serverId, onClose, onCreated, categories = [], initialCategoryId = '' }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('text')
  const [categoryId, setCategoryId] = useState(initialCategoryId || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      const data = await api(`/servers/${serverId}/channels`, { method: 'POST', body: { name, type, categoryId: categoryId || null } })
      onCreated(data.channel)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Create Channel"
      subtitle="in server"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || !name.trim()}>
            Create Channel
          </button>
        </>
      }
    >
      {error && <div className="auth-error">{error}</div>}
      <div className="channel-type-row">
        {[
          ['text', 'Text', 'Send messages, images, GIFs', <MessageIcon key="t" size={22} />],
          ['voice', 'Voice', 'Hang out with friends', <VolumeIcon key="v" size={22} />]
        ].map(([id, label, sub, Icon]) => (
          <button key={id} className={`channel-type ${type === id ? 'selected' : ''}`} onClick={() => setType(id)}>
            <span className="ct-icon">{Icon} {label}</span>
            <span className="ct-sub">{sub}</span>
          </button>
        ))}
      </div>
      <div className="form-field">
        <label>Channel Name</label>
        <div className="channel-name-field">
          <span className="ct-name-icon">{type === 'text' ? '#' : <VolumeIcon size={16} />}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="new-channel"
            autoFocus
            maxLength={32}
          />
        </div>
      </div>
      {categories.length > 0 && (
        <div className="form-field">
          <label>Category</label>
          <select className="settings-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
    </Modal>
  )
}

export function InviteModal({ serverId, serverName, onClose }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const create = async () => {
    setError('')
    setBusy(true)
    try {
      const data = await api(`/servers/${serverId}/invite`, { method: 'POST' })
      setCode(data.code)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* noop */ }
  }

  return (
    <Modal
      title="Invite People"
      subtitle={`to ${serverName}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Done</button>
        </>
      }
    >
      {error && <div className="auth-error">{error}</div>}
      {!code ? (
        <div className="invite-create">
          <p className="auth-hint">Generate an invite link people can use to join this server.</p>
          <button className="btn btn-primary" onClick={create} disabled={busy}>Create Invite</button>
        </div>
      ) : (
        <div className="invite-code-box">
          <div className="invite-code">{code}</div>
          <button className="btn btn-primary" onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
        </div>
      )}
    </Modal>
  )
}

export function DmModal({ onClose, onOpened }) {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        if (!cancelled) setUsers([])
        return
      }
      setBusy(true)
      try {
        const list = await api(`/users?query=${encodeURIComponent(query)}`)
        if (!cancelled) setUsers(list)
      } catch {
        /* noop */
      } finally {
        if (!cancelled) setBusy(false)
      }
    }, 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  const open = async (userId) => {
    try {
      const dm = await api('/dms', { method: 'POST', body: { userId } })
      onOpened(dm)
    } catch (err) {
      if (err.auth) return
      alert(err.message)
    }
  }

  return (
    <Modal title="Create a Direct Message" subtitle="Find your friends" onClose={onClose}>
      <div className="form-field">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a user…"
          autoFocus
        />
      </div>
      {busy && <div className="auth-hint">Searching…</div>}
      <div className="user-search-results">
        {users.map((u) => (
          <div key={u.id} className="user-result" onClick={() => open(u.id)}>
            <Avatar user={u} size={32} showStatus border="var(--bg-modal)" />
            <div>
              <div className="name">{u.username}</div>
              <div className="email">{u.online ? 'Online' : 'Offline'}</div>
            </div>
          </div>
        ))}
        {!busy && query.trim() && users.length === 0 && (
          <div className="empty-state" style={{ minHeight: 80 }}>
            <span>No users found</span>
          </div>
        )}
      </div>
    </Modal>
  )
}

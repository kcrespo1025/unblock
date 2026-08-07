import { useEffect, useState } from 'react'
import Avatar from './Avatar.jsx'
import { api } from '../api.js'
import { pickMediaFile, isImageDataUrl, isHttpUrl } from '../media.js'
import { PencilIcon, TrashIcon, FolderIcon, HashIcon, VolumeIcon, CloseIcon, UploadIcon } from '../icons.jsx'

const ICONS = ['🌐', '🎮', '🎵', '📚', '🏀', '🍕', '🐱', '🔥', '🎬', '🌙', '⚡', '💎', '🌿', '🚀', '🌈', '🎲']
const COLOR_PRESETS = ['#5865f2', '#eb459e', '#f0b232', '#23a55a', '#faa61a', '#ed4245', '#3ba55d', '#95a5fc']

const TABS = [
  ['overview', 'Overview'],
  ['roles', 'Roles'],
  ['members', 'Members'],
  ['channels', 'Channels'],
  ['invites', 'Invites'],
  ['emoji', 'Emoji'],
  ['bans', 'Bans']
]

export default function ServerSettingsModal({ server, onClose, onUpdated }) {
  const [tab, setTab] = useState('overview')

  return (
    <div className="settings-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal">
        <div className="settings-modal-head">
          <div className="settings-modal-title">
            <div className="settings-modal-name">{server.name}</div>
            <div className="settings-modal-sub">Server Settings</div>
          </div>
          <button className="settings-close" onClick={onClose}><CloseIcon size={18} /></button>
        </div>
        <div className="settings-modal-body">
          <div className="settings-tabs">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                className={`settings-tab ${tab === id ? 'active' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
            <div className="settings-tab-spacer" />
            {server.isOwner && (
              <button className="settings-tab danger" onClick={() => setTab('danger')}>
                Danger Zone
              </button>
            )}
          </div>
          <div className="settings-panel">
            {tab === 'overview' && <OverviewTab server={server} onUpdated={onUpdated} />}
            {tab === 'roles' && <RolesTab server={server} onUpdated={onUpdated} />}
            {tab === 'members' && <MembersTab server={server} onUpdated={onUpdated} />}
            {tab === 'channels' && <ChannelsTab server={server} onUpdated={onUpdated} />}
            {tab === 'invites' && <InvitesTab server={server} onUpdated={onUpdated} />}
            {tab === 'emoji' && <EmojiTab server={server} onUpdated={onUpdated} />}
            {tab === 'bans' && <BansTab server={server} onUpdated={onUpdated} />}
            {tab === 'danger' && <DangerTab server={server} onClose={onClose} onUpdated={onUpdated} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function useFlash() {
  const [flash, setFlash] = useState(null)
  return [
    flash,
    (msg) => {
      setFlash(msg)
      setTimeout(() => setFlash(null), 2500)
    }
  ]
}

function SectionTitle({ children }) {
  return <div className="settings-section-title">{children}</div>
}

function ErrorLine({ error }) {
  return error ? <div className="auth-error">{error}</div> : null
}

function srv(serverId, path, opts) {
  return api(`/servers/${serverId}${path}`, opts)
}

function OverviewTab({ server, onUpdated }) {
  const [name, setName] = useState(server.name)
  const [description, setDescription] = useState(server.description || '')
  const [banner, setBanner] = useState(server.banner || '')
  const [icon, setIcon] = useState(server.icon)
  const [iconMedia, setIconMedia] = useState(server.iconMedia || null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useFlash()

  const uploadIcon = async () => {
    setError('')
    try {
      const media = await pickMediaFile({ maxDim: 256 })
      if (media) setIconMedia(media.dataUrl)
    } catch (err) {
      setError(err.message)
    }
  }

  const save = async () => {
    setError('')
    setBusy(true)
    try {
      await srv(server.id, '', {
        method: 'PATCH',
        body: { name, description, banner: banner.trim() || null, icon, iconMedia }
      })
      setFlash('Server saved')
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-inner">
      <SectionTitle>Overview</SectionTitle>
      <ErrorLine error={error} />
      {flash && <div className="settings-flash">✓ {flash}</div>}

      <div className="settings-row">
        <div className="settings-label">Server icon</div>
        <div className="settings-icon-row">
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
          <button className="btn btn-ghost" onClick={uploadIcon}><UploadIcon size={16} /> Upload Image / Clip</button>
          {iconMedia && <button className="btn btn-ghost" onClick={() => setIconMedia(null)}><CloseIcon size={16} /></button>}
        </div>
        <div className="icon-grid">
          {ICONS.map((i) => (
            <button key={i} className={`icon-option ${icon === i ? 'selected' : ''}`} onClick={() => setIcon(i)}>
              {i}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row">
        <label className="settings-label">Server name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
      </div>

      <div className="settings-row">
        <label className="settings-label">Banner emoji</label>
        <div className="settings-banner-row">
          <input value={banner} onChange={(e) => setBanner(e.target.value)} maxLength={8} placeholder="🌌" />
          <span className="settings-hint">Shown across the top of the sidebar</span>
        </div>
      </div>

      <div className="settings-row">
        <label className="settings-label">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={300}
          placeholder="Tell people what this server is about…"
        />
      </div>

      <div className="settings-actions">
        <button className="btn btn-primary" onClick={save} disabled={busy || name.trim().length < 2}>
          {busy ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

function RolesTab({ server, onUpdated }) {
  const roles = server.customRoles || []
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLOR_PRESETS[0])
  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useFlash()

  const add = async () => {
    setError('')
    setBusy(true)
    try {
      await srv(server.id, '/roles', { method: 'POST', body: { name, color } })
      setName('')
      setColor(COLOR_PRESETS[0])
      setFlash('Role created')
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (role) => {
    setEditing(role.id)
    setEditName(role.name)
    setEditColor(role.color)
  }

  const saveEdit = async (rid) => {
    setError('')
    try {
      await srv(server.id, `/roles/${rid}`, { method: 'PATCH', body: { name: editName, color: editColor } })
      setEditing(null)
      setFlash('Role updated')
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    }
  }

  const remove = async (rid) => {
    setError('')
    if (!window.confirm('Delete this role? Members will lose it.')) return
    try {
      await srv(server.id, `/roles/${rid}`, { method: 'DELETE' })
      setFlash('Role deleted')
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    }
  }

  return (
    <div className="settings-inner">
      <SectionTitle>Roles</SectionTitle>
      <ErrorLine error={error} />
      {flash && <div className="settings-flash">✓ {flash}</div>}
      <p className="settings-hint">Create roles to group members. Owners and Admins are built-in.</p>

      <div className="role-add">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Role name" maxLength={32} />
        <div className="color-dots">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              className={`color-dot ${color === c ? 'selected' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <button className="btn btn-primary" onClick={add} disabled={busy || name.trim().length < 2}>Add Role</button>
      </div>

      <div className="settings-list">
        {roles.map((r) => (
          <div key={r.id} className="settings-list-item role-item">
            {editing === r.id ? (
              <div className="role-edit-row">
                <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={32} />
                <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} />
                <button className="btn btn-primary" onClick={() => saveEdit(r.id)}>Save</button>
                <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            ) : (
              <>
                <span className="role-dot" style={{ background: r.color }} />
                <span className="role-name">{r.name}</span>
                <span className="role-actions">
                  <button className="btn btn-ghost" onClick={() => startEdit(r)}><PencilIcon size={16} /></button>
                  <button className="btn btn-ghost danger" onClick={() => remove(r.id)}><TrashIcon size={16} /></button>
                </span>
              </>
            )}
          </div>
        ))}
        {roles.length === 0 && <div className="settings-empty">No custom roles yet</div>}
      </div>
    </div>
  )
}

function MembersTab({ server, onUpdated }) {
  const roles = server.customRoles || []
  const memberRoles = server.memberRoles || {}
  const adminIds = server.adminIds || []
  const [error, setError] = useState('')
  const [flash, setFlash] = useFlash()

  const assignRole = async (uid, roleId) => {
    setError('')
    try {
      await srv(server.id, `/members/${uid}/role`, { method: 'PATCH', body: { roleId } })
      setFlash('Member updated')
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    }
  }

  const toggleAdmin = async (uid, admin) => {
    setError('')
    try {
      await srv(server.id, `/members/${uid}/admin`, { method: 'POST', body: { admin } })
      setFlash(admin ? 'Promoted to Admin' : 'Demoted')
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    }
  }

  const kick = async (uid, username) => {
    setError('')
    if (!window.confirm(`Kick ${username} from this server?`)) return
    try {
      await srv(server.id, `/members/${uid}/kick`, { method: 'POST' })
      setFlash(`${username} was kicked`)
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    }
  }

  const deleteAccount = async (m) => {
    setError('')
    if (!window.confirm(`Delete ${m.username}'s account entirely? This removes their account, messages, and all their data across the app. This cannot be undone.`)) return
    if (!window.confirm(`Are you absolutely sure? ${m.username}'s account will be permanently deleted.`)) return
    try {
      await srv(server.id, `/members/${m.id}/delete-account`, { method: 'POST' })
      setFlash(`${m.username}'s account was deleted`)
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    }
  }

  return (
    <div className="settings-inner">
      <SectionTitle>Members — {server.members.length}</SectionTitle>
      <ErrorLine error={error} />
      {flash && <div className="settings-flash">✓ {flash}</div>}

      <div className="settings-list">
        {server.members.map((m) => {
          const isOwner = m.id === server.ownerId
          const isAdmin = adminIds.includes(m.id)
          const cur = memberRoles[m.id] || ''
          return (
            <div key={m.id} className="settings-list-item member-settings-row">
              <Avatar user={m} size={32} showStatus border="var(--bg-modal)" />
              <div className="member-settings-name">
                <span style={{ color: m.color }}>{m.username}</span>
                {isOwner && <span className="role-chip owner">Owner</span>}
                {isAdmin && <span className="role-chip admin">Admin</span>}
              </div>
              {!isOwner && (
                <>
                  <select
                    className="settings-select"
                    value={cur}
                    onChange={(e) => assignRole(m.id, e.target.value || null)}
                  >
                    <option value="">No role</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  {server.isOwner && (
                    <button
                      className={`btn ${isAdmin ? 'btn-ghost' : 'btn-ghost'}`}
                      onClick={() => toggleAdmin(m.id, !isAdmin)}
                      title={isAdmin ? 'Remove admin' : 'Make admin'}
                    >
                      {isAdmin ? 'Demote' : 'Promote'}
                    </button>
                  )}
                  <button className="btn btn-ghost danger" onClick={() => kick(m.id, m.username)}>Kick</button>
                  {server.isOwner && m.id !== server.ownerId && (
                    <button className="btn btn-ghost danger" onClick={() => deleteAccount(m)} title="Permanently delete this account and all its data">Delete Account</button>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ChannelsTab({ server, onUpdated }) {
  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')
  const [editTopic, setEditTopic] = useState('')
  const [editCat, setEditCat] = useState('')
  const [error, setError] = useState('')
  const [flash, setFlash] = useFlash()
  const [newCatName, setNewCatName] = useState('')
  const [editingCat, setEditingCat] = useState(null)
  const [catEditName, setCatEditName] = useState('')

  const categories = server.categories || []

  const startEdit = (ch) => {
    setEditing(ch.id)
    setEditName(ch.name)
    setEditTopic(ch.topic || '')
    setEditCat(ch.categoryId || '')
  }

  const save = async (cid) => {
    setError('')
    try {
      await srv(server.id, `/channels/${cid}`, { method: 'PATCH', body: { name: editName, topic: editTopic, categoryId: editCat || null } })
      setEditing(null)
      setFlash('Channel updated')
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    }
  }

  const reorderAll = async (nextIds) => {
    setError('')
    try {
      await srv(server.id, '/channels/reorder', { method: 'POST', body: { orderedIds: nextIds } })
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    }
  }

  const move = async (cid, dir) => {
    const idx = server.channels.findIndex((c) => c.id === cid)
    if (idx === -1) return
    const next = [...server.channels]
    const target = idx + (dir === 'up' ? -1 : 1)
    if (target < 0 || target >= next.length) return
    const tmp = next[idx]
    next[idx] = next[target]
    next[target] = tmp
    await reorderAll(next.map((c) => c.id))
  }

  const remove = async (ch) => {
    setError('')
    if (!window.confirm(`Delete #${ch.name}? Its messages will be gone forever.`)) return
    try {
      await srv(server.id, `/channels/${ch.id}`, { method: 'DELETE' })
      setFlash(`#${ch.name} deleted`)
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    }
  }

  const createCategory = async () => {
    const name = newCatName.trim()
    if (!name) return
    setError('')
    try {
      await srv(server.id, '/categories', { method: 'POST', body: { name } })
      setNewCatName('')
      setFlash('Category created')
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    }
  }

  const renameCategory = async (cat) => {
    setError('')
    try {
      await srv(server.id, `/categories/${cat.id}`, { method: 'PATCH', body: { name: catEditName } })
      setEditingCat(null)
      setFlash('Category renamed')
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    }
  }

  const removeCategory = async (cat) => {
    if (!window.confirm(`Delete category "${cat.name}"? Its channels stay but become uncategorized.`)) return
    setError('')
    try {
      await srv(server.id, `/categories/${cat.id}`, { method: 'DELETE' })
      setFlash('Category deleted')
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    }
  }

  const moveCategory = async (cat, dir) => {
    const idx = categories.findIndex((c) => c.id === cat.id)
    if (idx === -1) return
    const next = [...categories]
    const target = idx + (dir === 'up' ? -1 : 1)
    if (target < 0 || target >= next.length) return
    const tmp = next[idx]
    next[idx] = next[target]
    next[target] = tmp
    setError('')
    try {
      await srv(server.id, '/categories/reorder', { method: 'POST', body: { orderedIds: next.map((c) => c.id) } })
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    }
  }

  return (
    <div className="settings-inner">
      <SectionTitle>Channels</SectionTitle>
      <ErrorLine error={error} />
      {flash && <div className="settings-flash">✓ {flash}</div>}

      <div className="settings-list">
        {server.channels.map((ch, i) => (
          <div key={ch.id} className="settings-list-item channel-settings-row">
            {editing === ch.id ? (
              <div className="channel-edit-row">
                <span className="settings-hash">{ch.type === 'voice' ? <VolumeIcon size={16} /> : <HashIcon size={16} />}</span>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={32} />
                <input
                  value={editTopic}
                  onChange={(e) => setEditTopic(e.target.value)}
                  placeholder="Topic (optional)"
                  maxLength={200}
                />
                <select className="settings-select cat-select" value={editCat} onChange={(e) => setEditCat(e.target.value)}>
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button className="btn btn-primary" onClick={() => save(ch.id)}>Save</button>
                <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            ) : (
              <>
                <span className="settings-hash">{ch.type === 'voice' ? <VolumeIcon size={16} /> : <HashIcon size={16} />}</span>
                <span className="channel-settings-name">{ch.name}</span>
                <span className="channel-settings-cat">
                  {ch.categoryId ? categories.find((c) => c.id === ch.categoryId)?.name : '—'}
                </span>
                <span className="role-actions">
                  <button className="btn btn-ghost" onClick={() => move(ch.id, 'up')} disabled={i === 0} title="Move up">↑</button>
                  <button className="btn btn-ghost" onClick={() => move(ch.id, 'down')} disabled={i === server.channels.length - 1} title="Move down">↓</button>
                  <button className="btn btn-ghost" onClick={() => startEdit(ch)}><PencilIcon size={16} /></button>
                  <button className="btn btn-ghost danger" onClick={() => remove(ch)}><TrashIcon size={16} /></button>
                </span>
              </>
            )}
          </div>
        ))}
      </div>

      <SectionTitle>Categories</SectionTitle>
      <div className="settings-list">
        {categories.map((cat, i) => (
          <div key={cat.id} className="settings-list-item channel-settings-row">
            {editingCat === cat.id ? (
              <div className="channel-edit-row">
                <span className="settings-hash"><FolderIcon size={16} /></span>
                <input value={catEditName} onChange={(e) => setCatEditName(e.target.value)} maxLength={32} />
                <button className="btn btn-primary" onClick={() => renameCategory(cat)}>Save</button>
                <button className="btn btn-ghost" onClick={() => setEditingCat(null)}>Cancel</button>
              </div>
            ) : (
              <>
                <span className="settings-hash"><FolderIcon size={16} /></span>
                <span className="channel-settings-name">{cat.name}</span>
                <span className="channel-settings-cat">
                  {server.channels.filter((c) => c.categoryId === cat.id).length} channel
                  {server.channels.filter((c) => c.categoryId === cat.id).length === 1 ? '' : 's'}
                </span>
                <span className="role-actions">
                  <button className="btn btn-ghost" onClick={() => moveCategory(cat, 'up')} disabled={i === 0} title="Move up">↑</button>
                  <button className="btn btn-ghost" onClick={() => moveCategory(cat, 'down')} disabled={i === categories.length - 1} title="Move down">↓</button>
                  <button className="btn btn-ghost" onClick={() => { setEditingCat(cat.id); setCatEditName(cat.name) }}><PencilIcon size={16} /></button>
                  <button className="btn btn-ghost danger" onClick={() => removeCategory(cat)}><TrashIcon size={16} /></button>
                </span>
              </>
            )}
          </div>
        ))}
        <div className="settings-list-item channel-edit-row">
          <span className="settings-hash"><FolderIcon size={16} /></span>
          <input
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="New category name"
            maxLength={32}
          />
          <button className="btn btn-primary" onClick={createCategory} disabled={!newCatName.trim()}>Create</button>
        </div>
      </div>
    </div>
  )
}

function InvitesTab({ server, onUpdated }) {
  const invites = server.invites || []
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useFlash()

  const create = async () => {
    setError('')
    setBusy(true)
    try {
      await srv(server.id, '/invite', { method: 'POST' })
      setFlash('Invite created')
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (code) => {
    setError('')
    try {
      await srv(server.id, `/invites/${code}`, { method: 'DELETE' })
      setFlash('Invite revoked')
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    }
  }

  return (
    <div className="settings-inner">
      <SectionTitle>Invites</SectionTitle>
      <ErrorLine error={error} />
      {flash && <div className="settings-flash">✓ {flash}</div>}

      <button className="btn btn-primary" onClick={create} disabled={busy}>+ Create Invite</button>

      <div className="settings-list" style={{ marginTop: 12 }}>
        {invites.map((inv) => (
          <div key={inv.code} className="settings-list-item invite-settings-row">
            <code className="invite-code-sm">{inv.code}</code>
            <span className="settings-hint">
              {new Date(inv.createdAt).toLocaleDateString()}
            </span>
            <button className="btn btn-ghost danger" onClick={() => revoke(inv.code)}>Revoke</button>
          </div>
        ))}
        {invites.length === 0 && <div className="settings-empty">No active invites</div>}
      </div>
    </div>
  )
}

function EmojiTab({ server, onUpdated }) {
  const emojis = server.emojis || []
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [media, setMedia] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useFlash()

  const upload = async () => {
    setError('')
    try {
      const m = await pickMediaFile({ maxDim: 128 })
      if (m) setMedia(m.dataUrl)
    } catch (err) {
      setError(err.message)
    }
  }

  const add = async () => {
    setError('')
    setBusy(true)
    try {
      await srv(server.id, '/emoji', { method: 'POST', body: { name, emoji: emoji || null, media } })
      setName('')
      setEmoji('')
      setMedia(null)
      setFlash('Emoji added')
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (eid, ename) => {
    setError('')
    try {
      await srv(server.id, `/emoji/${eid}`, { method: 'DELETE' })
      setFlash(`:${ename}: removed`)
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    }
  }

  return (
    <div className="settings-inner">
      <SectionTitle>Custom Emoji</SectionTitle>
      <ErrorLine error={error} />
      {flash && <div className="settings-flash">✓ {flash}</div>}
      <p className="settings-hint">Use them anywhere by typing :name: in a message.</p>

      <div className="emoji-add">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name (e.g. pog)" maxLength={6} />
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="emoji 😎" maxLength={8} />
        {media ? (
          isImageDataUrl(media) || isHttpUrl(media) ? (
            <img className="emoji-preview" src={media} alt="" />
          ) : (
            <video className="emoji-preview" src={media} muted loop autoPlay playsInline />
          )
        ) : null}
        <button className="btn btn-ghost" onClick={upload}><UploadIcon size={16} /> Image / Clip</button>
        <button className="btn btn-primary" onClick={add} disabled={busy || name.trim().length < 2}>
          Add
        </button>
      </div>

      <div className="settings-list">
        {emojis.map((e) => (
          <div key={e.id} className="settings-list-item emoji-settings-row">
            {e.media ? (
              isImageDataUrl(e.media) || isHttpUrl(e.media) ? (
                <img className="emoji-preview" src={e.media} alt="" />
              ) : (
                <video className="emoji-preview" src={e.media} muted loop autoPlay playsInline />
              )
            ) : (
              <span className="emoji-preview">{e.emoji}</span>
            )}
            <span className="role-name">:{e.name}:</span>
            <button className="btn btn-ghost danger" onClick={() => remove(e.id, e.name)}><TrashIcon size={16} /></button>
          </div>
        ))}
        {emojis.length === 0 && <div className="settings-empty">No custom emoji yet</div>}
      </div>
    </div>
  )
}

function BansTab({ server, onUpdated }) {
  const bans = server.bans || []
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [reason, setReason] = useState('')
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useFlash()

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        if (!cancelled) setResults([])
        return
      }
      try {
        const list = await api(`/users?query=${encodeURIComponent(query.trim())}`)
        if (!cancelled) setResults(list)
      } catch {
        /* noop */
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  const ban = async () => {
    if (!selected) return
    setError('')
    setBusy(true)
    try {
      await srv(server.id, '/bans', { method: 'POST', body: { userId: selected.id, reason } })
      setFlash(`${selected.username} was banned`)
      setSelected(null)
      setQuery('')
      setReason('')
      setResults([])
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const unban = async (uid, username) => {
    setError('')
    try {
      await srv(server.id, `/bans/${uid}`, { method: 'DELETE' })
      setFlash(`${username} was unbanned`)
      onUpdated()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    }
  }

  return (
    <div className="settings-inner">
      <SectionTitle>Bans</SectionTitle>
      <ErrorLine error={error} />
      {flash && <div className="settings-flash">✓ {flash}</div>}

      <div className="ban-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a user to ban…"
        />
        {selected && (
          <div className="ban-selected">
            <Avatar user={selected} size={24} />
            <span>{selected.username}</span>
            <button onClick={() => setSelected(null)}><CloseIcon size={14} /></button>
          </div>
        )}
        {results.length > 0 && (
          <div className="ban-results">
            {results.map((u) => (
              <button key={u.id} className="ban-result" onClick={() => setSelected(u)}>
                <Avatar user={u} size={24} />
                <span>{u.username}</span>
              </button>
            ))}
          </div>
        )}
        {selected && (
          <div className="ban-reason">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              maxLength={200}
            />
            <button className="btn btn-primary" onClick={ban} disabled={busy}>Ban</button>
          </div>
        )}
      </div>

      <div className="settings-list">
        {bans.map((b) => (
          <div key={b.user.id} className="settings-list-item member-settings-row">
            <Avatar user={b.user} size={32} showStatus border="var(--bg-modal)" />
            <div className="member-settings-name">
              <span style={{ color: b.user.color }}>{b.user.username}</span>
              {b.reason && <span className="settings-hint">— {b.reason}</span>}
            </div>
            <button className="btn btn-ghost" onClick={() => unban(b.user.id, b.user.username)}>Unban</button>
          </div>
        ))}
        {bans.length === 0 && <div className="settings-empty">No banned users</div>}
      </div>
    </div>
  )
}

function DangerTab({ server, onClose, onUpdated }) {
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState('')

  const del = async () => {
    if (confirm !== server.name) {
      alert('Type the server name to confirm.')
      return
    }
    setBusy(true)
    try {
      await srv(server.id, '', { method: 'DELETE' })
      onUpdated()
      onClose()
    } catch (err) {
      if (err.auth) return
      alert(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="settings-inner">
      <SectionTitle>Danger Zone</SectionTitle>
      <p className="settings-hint">
        Deleting <strong>{server.name}</strong> removes every channel, message and invite instantly.
        This cannot be undone.
      </p>
      <div className="settings-row">
        <label className="settings-label">Type <code>{server.name}</code> to confirm</label>
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={server.name} />
      </div>
      <button className="btn btn-danger" onClick={del} disabled={busy || confirm !== server.name}>
        {busy ? 'Deleting…' : 'Delete Server'}
      </button>
    </div>
  )
}

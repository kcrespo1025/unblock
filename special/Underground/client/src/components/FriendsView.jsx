import { useState } from 'react'
import Avatar from './Avatar.jsx'
import ProfilePopout from './ProfilePopout.jsx'
import { api } from '../api.js'
import { FriendsIcon, MessageIcon } from '../icons.jsx'

export default function FriendsView({ me, data, onRefresh, onOpenDm }) {
  const [tab, setTab] = useState('online')
  const [addEmail, setAddEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [popout, setPopout] = useState(null)

  const friends = data.friends || []
  const incoming = data.incoming || []
  const outgoing = data.outgoing || []

  const visible = friends.filter((f) => {
    if (tab === 'online') return f.online
    if (tab === 'all') return true
    return false
  })

  const addFriend = async () => {
    setError('')
    if (!addEmail.trim()) return
    setBusy(true)
    try {
      await api('/friends/request', { method: 'POST', body: { email: addEmail.trim() } })
      setAddEmail('')
      await onRefresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const addFriendById = async (user) => {
    try {
      await api('/friends/request', { method: 'POST', body: { userId: user.id } })
      setPopout(null)
      await onRefresh()
    } catch (err) {
      if (err.auth) return
      alert(err.message)
    }
  }

  const act = async (fn) => {
    await fn()
    await onRefresh()
  }

  const tabs = [
    { id: 'online', label: 'Online', count: friends.filter((f) => f.online).length },
    { id: 'all', label: 'All', count: friends.length },
    { id: 'pending', label: 'Pending', count: incoming.length + outgoing.length }
  ]

  const Popout = ({ user, state }) => (
    <div className="popout-layer" onMouseDown={(e) => e.target === e.currentTarget && setPopout(null)}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 200 }}>
        <ProfilePopout
          user={user}
          isMe={user.id === me.id}
          onClose={() => setPopout(null)}
          onDm={() => { setPopout(null); onOpenDm(user) }}
          onAddFriend={() => addFriendById(user)}
          friendState={state}
        />
      </div>
    </div>
  )

  return (
    <div className="chat-wrap friends-wrap">
      <div className="chat-header">
        <span className="hash"><FriendsIcon size={20} /></span>
        <span>Friends</span>
      </div>
      <div className="friends-toolbar">
        <div className="friends-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`friends-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.count > 0 && <span className="friends-count">{t.count}</span>}
            </button>
          ))}
        </div>
        <div className="friends-add">
          <input
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFriend()}
            placeholder="Add friend by email"
          />
          <button className="btn btn-primary" onClick={addFriend} disabled={busy}>Add</button>
        </div>
      </div>
      {error && <div className="friends-error">{error}</div>}

      <div className="friends-list">
        {tab === 'pending' ? (
          <>
            {incoming.map((r) => (
              <div className="friend-row" key={r.id}>
                <div className="friend-main" onClick={() => setPopout({ user: r.user, state: 'incoming' })}>
                  <Avatar user={r.user} size={40} showStatus />
                  <div className="friend-info">
                    <span className="friend-name">{r.user.username}</span>
                    <span className="friend-sub">Incoming friend request</span>
                  </div>
                </div>
                <div className="friend-btns">
                  <button className="act-ok" title="Accept" onClick={() => act(() => api(`/friends/${r.id}/accept`, { method: 'POST' }))}>✓</button>
                  <button className="act-no" title="Decline" onClick={() => act(() => api(`/friends/${r.id}/decline`, { method: 'POST' }))}>✕</button>
                </div>
              </div>
            ))}
            {outgoing.map((r) => (
              <div className="friend-row" key={r.id}>
                <div className="friend-main" onClick={() => setPopout({ user: r.user, state: 'outgoing' })}>
                  <Avatar user={r.user} size={40} showStatus />
                  <div className="friend-info">
                    <span className="friend-name">{r.user.username}</span>
                    <span className="friend-sub">Outgoing friend request</span>
                  </div>
                </div>
                <div className="friend-btns">
                  <button className="act-no" title="Cancel" onClick={() => act(() => api(`/friends/${r.id}/remove`, { method: 'POST' }))}>✕</button>
                </div>
              </div>
            ))}
            {incoming.length + outgoing.length === 0 && <div className="friends-empty">No pending requests</div>}
          </>
        ) : (
          <>
            {visible.map((f) => (
              <div className="friend-row" key={f.id}>
                <div className="friend-main" onClick={() => setPopout({ user: f, state: 'friends' })}>
                  <Avatar user={f} size={40} showStatus />
                  <div className="friend-info">
                    <span className="friend-name">{f.username}</span>
                    <span className="friend-sub">{f.online ? (f.status === 'idle' ? 'Idle' : f.status === 'dnd' ? 'Do Not Disturb' : 'Online') : 'Offline'}</span>
                  </div>
                </div>
                <div className="friend-btns">
                  <button className="act-ok" title="Message" onClick={() => onOpenDm(f)}><MessageIcon size={16} /></button>
                </div>
              </div>
            ))}
            {visible.length === 0 && <div className="friends-empty">No friends here yet — add one above!</div>}
          </>
        )}
      </div>

      {popout && <Popout user={popout.user} state={popout.state} />}
    </div>
  )
}

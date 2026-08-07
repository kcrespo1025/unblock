import { useState } from 'react'
import Avatar from './Avatar.jsx'
import ProfilePopout from './ProfilePopout.jsx'

function MemberRow({ user, role, friendState, onDm, onAddFriend, me }) {
  const [popout, setPopout] = useState(false)
  return (
    <>
      <div
        className="member"
        onClick={(e) => {
          e.stopPropagation()
          setPopout(true)
        }}
      >
        <Avatar user={user} size={32} showStatus border="var(--bg-sidebar)" />
        <span className="name" style={role ? { color: role.color } : undefined}>{user.username}</span>
        {user.customStatus && <span className="member-custom-status">{user.customStatus}</span>}
      </div>
      {popout && (
        <div className="popout-layer" onMouseDown={(e) => e.target === e.currentTarget && setPopout(false)}>
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 200 }}>
            <ProfilePopout
              user={user}
              isMe={user.id === me.id}
              role={role}
              onClose={() => setPopout(false)}
              onDm={() => { setPopout(false); onDm && onDm(user) }}
              onAddFriend={() => { setPopout(false); onAddFriend && onAddFriend(user) }}
              friendState={friendState}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default function MemberList({ members, roles = {}, friendStates = {}, onDm, onAddFriend, me }) {
  const byName = {}
  const order = ['Owner', 'Admin']
  for (const m of members) {
    const role = roles[m.id]
    const name = role ? role.name : 'Member'
    if (role && !order.includes(name) && !byName[name]) order.push(name)
    if (!byName[name]) byName[name] = []
    byName[name].push(m)
  }
  if (byName['Member']) order.push('Member')

  const renderGroup = (name) => {
    const list = byName[name] || []
    if (!list.length) return null
    const online = list.filter((m) => m.online)
    const offline = list.filter((m) => !m.online)
    const roleColor = roles[online[0]?.id] || roles[offline[0]?.id]
    return (
      <div key={name} className="member-group">
        <span style={roleColor ? { color: roleColor.color } : undefined}>{name} — {list.length}</span>
        {online.map((m) => (
          <MemberRow
            key={m.id}
            user={m}
            role={roles[m.id]}
            friendState={friendStates[m.id] || 'none'}
            onDm={onDm}
            onAddFriend={onAddFriend}
            me={me}
          />
        ))}
        {offline.map((m) => (
          <MemberRow
            key={m.id}
            user={m}
            role={roles[m.id]}
            friendState={friendStates[m.id] || 'none'}
            onDm={onDm}
            onAddFriend={onAddFriend}
            me={me}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="member-list">
      {order.map(renderGroup)}
      {members.length === 0 && <div className="member-group">No members</div>}
    </div>
  )
}

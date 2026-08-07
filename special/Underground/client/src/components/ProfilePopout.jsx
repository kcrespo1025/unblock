import Avatar from './Avatar.jsx'
import { bannerCss, profileTheme, decorationById } from '../themes.js'
import { PencilIcon, CheckIcon, ImageIcon, GearIcon } from '../icons.jsx'
import UserBadges from './UserBadges.jsx'

const STATUS_LABEL = { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline' }

export default function ProfilePopout({ user, isMe, role, onClose, onDm, onAddFriend, friendState, onEditProfile }) {
  const status = user.online ? user.status : 'offline'
  const theme = profileTheme(user.profileTheme)
  const themed = theme.id !== 'classic'
  const banner = user.banner
    ? bannerCss(user.banner)
    : themed
      ? theme.banner
      : (user.color ? `linear-gradient(120deg, ${user.color}, ${user.color}55)` : 'var(--accent)')
  const deco = decorationById(user.decoration)

  return (
    <div
      className={`profile-popout ${themed ? 'profile-themed' : ''}`}
      style={themed ? { background: theme.body, boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 32px ${theme.glow}44` } : undefined}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="profile-banner" style={{ background: banner }} />
      <div className="profile-body">
        <div className="profile-avatar">
          <Avatar user={user} size={80} showStatus border={themed ? 'rgba(0,0,0,0.45)' : 'var(--bg-modal)'} />
        </div>
        <div className="profile-name">
          <h3 style={themed ? { color: theme.nameColor } : undefined}>{user.username}</h3>
          {user.title && (
            <span className="dev-badge profile-dev-badge" style={{ color: user.title.color || '#ffd700' }}>
              {user.title.icon || <GearIcon size={12} />} {user.title.name}
            </span>
          )}
          <UserBadges badges={user.badges} size={18} className="profile-badges" />
          {user.pronoun && <span className="profile-pronoun">{user.pronoun}</span>}
          {role && <span className="profile-role" style={{ color: role.color || '#b5bac1' }}>{role.name}</span>}
        </div>
        <div className="profile-status">
          <div className={`profile-status-label status-${status}`}>
            <span className="pdot" />
            {STATUS_LABEL[status] || 'Offline'}
          </div>
          {user.customStatus && <div className="profile-custom">{user.customStatus}</div>}
        </div>
        {user.bio && <div className="profile-bio">{user.bio}</div>}

        {isMe && (
          <div className="profile-flair">
            <span className="profile-theme-badge">{theme.icon} {theme.name}</span>
            {deco && <span className="profile-theme-badge">{deco.emoji || '💍'} {deco.name || 'Decoration'}</span>}
            {user.banner && <span className="profile-theme-badge"><ImageIcon size={12} /> Banner</span>}
          </div>
        )}

        <div className="profile-actions">
          {isMe ? (
            <>
              <button className="btn btn-primary" onClick={onEditProfile}><PencilIcon size={16} /> Edit Profile</button>
              <button className="btn btn-ghost" onClick={onClose}>Close</button>
            </>
          ) : (
            <>
              {!isMe && (
                <button className="btn btn-primary" onClick={onDm}>Message</button>
              )}
              {!isMe && friendState === 'none' && (
                <button className="btn btn-ghost" onClick={onAddFriend}>Add Friend</button>
              )}
              {!isMe && friendState === 'friends' && (
                <span className="profile-friend-tag"><CheckIcon size={14} /> Friends</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

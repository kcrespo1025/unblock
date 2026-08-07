import { initials } from '../utils.js'
import { gradientCss, decorationById } from '../themes.js'
import { isImageDataUrl, isHttpUrl } from '../media.js'

const STATUS_COLOR = {
  online: 'var(--online)',
  idle: 'var(--idle)',
  dnd: 'var(--dnd)',
  offline: 'var(--offline)'
}

export default function Avatar({ user, size = 40, showStatus = false, border, showDecoration = true }) {
  const gradient = user?.gradient ? gradientCss(user.gradient) : null
  const deco = showDecoration && user?.decoration && size >= 28 ? decorationById(user.decoration) : null
  const decoSize = size * 0.5

  const renderDeco = () => {
    if (!deco) return null
    if (deco.type === 'emoji') {
      return (
        <span
          className="avatar-deco"
          style={{
            fontSize: decoSize,
            top: deco.top,
            right: deco.right,
            bottom: deco.bottom,
            left: deco.left,
            transform: `rotate(${deco.rot || 0}deg)`,
            animation: deco.spin ? 'deco-spin 3s linear infinite' : undefined
          }}
        >
          {deco.emoji}
        </span>
      )
    }
    if (deco.type === 'ring') {
      return (
        <span
          className={`avatar-deco-ring ${user.decoration === 'dualring' ? 'dual' : ''}`}
          style={{ borderColor: user?.color || 'var(--accent)' }}
        />
      )
    }
    if (deco.type === 'aura') {
      return (
        <span
          className="avatar-deco-aura"
          style={{ background: `radial-gradient(circle, ${user?.color || 'var(--accent)'}55, transparent 68%)` }}
        />
      )
    }
    return null
  }

  const renderMedia = () => {
    const src = user?.avatarMedia
    if (!src) return null
    if (isImageDataUrl(src) || isHttpUrl(src)) {
      return <img className="avatar-media" src={src} alt="" draggable={false} />
    }
    return <video className="avatar-media" src={src} muted loop autoPlay playsInline />
  }

  return (
    <div
      className={`avatar ${user?.avatar ? 'avatar-emoji' : ''}`}
      style={{
        width: size,
        height: size,
        fontSize: user?.avatar ? size * 0.5 : size * 0.38,
        background: gradient || user?.color || 'var(--accent)',
        backgroundImage: gradient || undefined,
        backgroundSize: 'cover'
      }}
    >
      {renderMedia() || user?.avatar || initials(user?.username)}
      {renderDeco()}
      {showStatus && user && (
        <span
          className="presence-dot"
          style={{
            background: STATUS_COLOR[user.online ? user.status : 'offline'] || 'var(--offline)',
            borderColor: border || 'var(--bg-chat)'
          }}
        />
      )}
    </div>
  )
}

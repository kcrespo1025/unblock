import { useEffect, useRef } from 'react'
import Avatar from './Avatar.jsx'
import { PhoneIcon, PhoneOffIcon, VideoIcon, ScreenShareIcon, HeadphonesIcon, MicIcon, MicOffIcon, CloseIcon } from '../icons.jsx'

function VideoFeed({ stream, muted, mirror, className, deafened }) {
  const ref = useRef(null)
  useEffect(() => {
    const v = ref.current
    if (!v || !stream) return
    try {
      v.srcObject = stream
      v.muted = !!(muted || deafened)
      const p = v.play()
      if (p && p.catch) p.catch(() => {})
    } catch { /* noop */ }
  }, [stream, muted, deafened])
  useEffect(() => {
    const v = ref.current
    return () => { if (v) { try { v.srcObject = null } catch { /* noop */ } } }
  }, [])
  return <video ref={ref} className={className} autoPlay playsInline muted={!!(muted || deafened)} style={mirror ? { transform: 'scaleX(-1)' } : undefined} />
}

function Tile({ user, stream, kind, connected, speaking, muted, deafened, self, compact }) {
  const showVideo = kind === 'camera' || kind === 'screen'
  const grad = user?.gradient || user?.color || 'var(--accent)'
  return (
    <div className={`call-tile ${compact ? 'compact' : ''} ${speaking ? 'speaking' : ''} ${connected ? 'connected' : 'not-connected'}`}>
      <div className="call-tile-media" style={{ background: showVideo ? undefined : grad }}>
        {showVideo && stream ? (
          <VideoFeed stream={stream} muted={self || deafened} deafened={deafened} mirror={self} className="call-video" />
        ) : (
          <div className="call-tile-avatar"><Avatar user={user} size={compact ? 48 : 84} showDecoration={!compact} /></div>
        )}
        {!connected && <div className="call-tile-connecting"><span className="dot-flash">Connecting…</span></div>}
        {muted && !self && <div className="call-tile-badge muted"><MicOffIcon size={14} /></div>}
        {deafened && !self && <div className="call-tile-badge deaf"><HeadphonesIcon size={14} /></div>}
        {kind === 'screen' && <div className="call-tile-share"><ScreenShareIcon size={14} /> Screen</div>}
      </div>
      <div className="call-tile-name">
        <span className={speaking ? 'speaking-name' : ''}>{user?.username}</span>
        {self && <span className="call-tile-self">(You)</span>}
      </div>
    </div>
  )
}

function CtrlBtn({ onClick, active, danger, title, children }) {
  return (
    <button
      className={`call-ctrl ${active ? 'active' : ''} ${danger ? 'danger' : ''}`}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function VoiceChannelView({
  channelName,
  serverName,
  self,
  participants,
  muted,
  deafened,
  screenActive,
  onToggleMute,
  onToggleDeafen,
  onStartScreen,
  onDisconnect
}) {
  return (
    <div className="voice-view">
      <div className="voice-view-header">
        <div className="voice-view-title">
          <div className="voice-view-icon"><VolumeBars /></div>
          <div>
            <div className="voice-view-name">{channelName}</div>
            <div className="voice-view-sub">Voice Connected in {serverName}</div>
          </div>
        </div>
      </div>
      <div className="voice-view-tiles">
        {participants.map((p) => (
          <Tile
            key={p.user?.id}
            user={p.user}
            stream={p.stream}
            kind={p.kind}
            connected={p.connected}
            speaking={p.speaking}
            muted={p.muted}
            deafened={p.deafened}
            self={p.self}
          />
        ))}
        {participants.length === 0 && <div className="voice-view-empty">No one is in this channel yet</div>}
      </div>
      <div className="call-controls">
        <div className="call-controls-left">
          <CtrlBtn onClick={onToggleMute} active={muted} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <MicOffIcon size={18} /> : <MicIcon size={18} />}
          </CtrlBtn>
          <CtrlBtn onClick={onToggleDeafen} active={deafened} title={deafened ? 'Undeafen' : 'Deafen'}>
            <HeadphonesIcon size={18} />
          </CtrlBtn>
          <span className="call-controls-id">{self?.username}</span>
        </div>
        <div className="call-controls-right">
          <CtrlBtn onClick={onStartScreen} active={screenActive} title="Share your screen">
            <ScreenShareIcon size={18} />
          </CtrlBtn>
          <CtrlBtn onClick={onDisconnect} danger title="Disconnect">
            <PhoneOffIcon size={18} />
          </CtrlBtn>
        </div>
      </div>
    </div>
  )
}

export function DmCallView({
  stage,
  title,
  peer,
  self,
  participants,
  muted,
  deafened,
  cameraOn,
  screenActive,
  onToggleMute,
  onToggleDeafen,
  onToggleCamera,
  onStartScreen,
  onEndCall
}) {
  if (stage === 'ringing') {
    return (
      <div className="dm-call ringing">
        <div className="dm-call-ring-avatar">
          <div className="pulse-ring" />
          <Avatar user={peer} size={96} />
        </div>
        <div className="dm-call-status">Calling <strong>{title}</strong>…</div>
        <div className="dm-call-dots"><span /><span /><span /></div>
        <div className="dm-call-actions">
          <CtrlBtn onClick={onEndCall} danger title="Cancel">
            <PhoneOffIcon size={20} />
          </CtrlBtn>
        </div>
      </div>
    )
  }

  if (stage === 'declined') {
    return (
      <div className="dm-call ringing">
        <div className="dm-call-ring-avatar">
          <Avatar user={peer} size={96} />
        </div>
        <div className="dm-call-status"><strong>{title}</strong> declined the call</div>
        <div className="dm-call-actions">
          <CtrlBtn onClick={onEndCall} title="Close">
            <CloseIcon size={20} />
          </CtrlBtn>
        </div>
      </div>
    )
  }

  return (
    <div className="dm-call">
      <div className="dm-call-header">
        <div>
          <div className="dm-call-name">{title}</div>
          <div className="dm-call-sub">{stage === 'connecting' ? 'Connecting…' : 'Voice Connected'}</div>
        </div>
        <button className="dm-call-close" title="Leave call" onClick={onEndCall}><CloseIcon size={18} /></button>
      </div>
      <div className="dm-call-tiles">
        {participants.map((p) => (
          <Tile
            key={p.user?.id}
            user={p.user}
            stream={p.stream}
            kind={p.kind}
            connected={p.connected}
            speaking={p.speaking}
            muted={p.muted}
            deafened={p.deafened}
            self={p.self}
            compact
          />
        ))}
      </div>
      <div className="call-controls">
        <div className="call-controls-left">
          <CtrlBtn onClick={onToggleMute} active={muted} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <MicOffIcon size={18} /> : <MicIcon size={18} />}
          </CtrlBtn>
          <CtrlBtn onClick={onToggleDeafen} active={deafened} title={deafened ? 'Undeafen' : 'Deafen'}>
            <HeadphonesIcon size={18} />
          </CtrlBtn>
          <CtrlBtn onClick={onToggleCamera} active={cameraOn} title={cameraOn ? 'Stop camera' : 'Start camera'}>
            <VideoIcon size={18} />
          </CtrlBtn>
          <CtrlBtn onClick={onStartScreen} active={screenActive} title="Share your screen">
            <ScreenShareIcon size={18} />
          </CtrlBtn>
        </div>
        <div className="call-controls-right">
          <CtrlBtn onClick={onEndCall} danger title="Hang up">
            <PhoneOffIcon size={18} />
          </CtrlBtn>
        </div>
      </div>
    </div>
  )
}

export function IncomingCallOverlay({ user, onAccept, onDecline }) {
  return (
    <div className="incoming-call-overlay" onMouseDown={(e) => e.target === e.currentTarget && onDecline()}>
      <div className="incoming-call-card">
        <div className="incoming-call-brand">Underground</div>
        <div className="incoming-call-avatar">
          <div className="pulse-ring green" />
          <Avatar user={user} size={120} />
        </div>
        <div className="incoming-call-title">Incoming Call</div>
        <div className="incoming-call-name">{user?.username}</div>
        <div className="incoming-call-sub">Discord</div>
        <div className="incoming-call-actions">
          <button className="incoming-btn decline" title="Decline" onClick={onDecline}><PhoneOffIcon size={26} /></button>
          <button className="incoming-btn accept" title="Accept" onClick={onAccept}><PhoneIcon size={26} /></button>
        </div>
      </div>
    </div>
  )
}

export function VoiceBanner({ channelName, muted, deafened, onToggleMute, onToggleDeafen, onDisconnect }) {
  return (
    <div className="voice-banner">
      <div className="voice-banner-info">
        <span className="voice-banner-icon"><VolumeBars /></span>
        <span className="voice-banner-title">Voice Connected</span>
        <span className="voice-banner-sep">•</span>
        <span className="voice-banner-name">{channelName}</span>
      </div>
      <div className="voice-banner-controls">
        <button className={`voice-banner-btn ${muted ? 'active' : ''}`} title={muted ? 'Unmute' : 'Mute'} onClick={onToggleMute}>
          {muted ? <MicOffIcon size={16} /> : <MicIcon size={16} />}
        </button>
        <button className={`voice-banner-btn ${deafened ? 'active' : ''}`} title={deafened ? 'Undeafen' : 'Deafen'} onClick={onToggleDeafen}>
          <HeadphonesIcon size={16} />
        </button>
        <button className="voice-banner-btn" title="Disconnect" onClick={onDisconnect}>
          <PhoneOffIcon size={16} />
        </button>
      </div>
    </div>
  )
}

function VolumeBars() {
  return (
    <span className="volume-bars">
      <span /><span /><span /><span />
    </span>
  )
}

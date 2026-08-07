import { useState } from 'react'
import Avatar from './Avatar.jsx'
import ProfilePopout from './ProfilePopout.jsx'
import { PlusIcon, DoorOpenIcon, PencilIcon, ArchiveIcon, TrashIcon, FileTextIcon, VolumeIcon, ThreadIcon, GearIcon, LogOutIcon, CloseIcon, SmileIcon } from '../icons.jsx'

export default function Sidebar({
  view,
  server,
  dms,
  user,
  unread,
  onSelectChannel,
  onSelectDm,
  onSelectThread,
  onThreadAction,
  onCreateChannel,
  onCreateDm,
  onLeaveServer,
  onUpdateStatus,
  onLogout,
  onSettings,
  onInvite,
  onServerSettings,
  onHome,
  onEditProfile,
  voiceChannels,
  myVoice,
  speaking,
  onJoinVoice,
  onLeaveVoice,
  canManage,
  onReorderChannels,
  onReorderCategories,
  onChannelAction
}) {
  const [serverMenu, setServerMenu] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [selfPopout, setSelfPopout] = useState(false)
  const [collapsed, setCollapsed] = useState({})
  const [dragChannel, setDragChannel] = useState(null)
  const [dragCategory, setDragCategory] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [threadMenu, setThreadMenu] = useState(null)
  const [channelMenu, setChannelMenu] = useState(null)

  const inServer = view && (view.type === 'server' || view.type === 'thread')
  const channels = server ? server.channels : []
  const categories = server ? server.categories || [] : []
  const threads = server ? server.threads || [] : []
  const connectedCount = (chId) => (voiceChannels && voiceChannels[chId] ? voiceChannels[chId].length : 0)
  const speakingCount = (chId) =>
    (voiceChannels && voiceChannels[chId] ? voiceChannels[chId].filter((id) => speaking && speaking[id]).length : 0)

  const grouped = categories.map((cat) => ({
    ...cat,
    text: channels.filter((c) => c.categoryId === cat.id && c.type !== 'voice'),
    voice: channels.filter((c) => c.categoryId === cat.id && c.type === 'voice')
  }))
  const uncatText = channels.filter((c) => !c.categoryId && c.type !== 'voice')
  const uncatVoice = channels.filter((c) => !c.categoryId && c.type === 'voice')

  const renderChannel = (ch) => {
    const isVoice = ch.type === 'voice'
    const active = isVoice ? myVoice && myVoice.channelId === ch.id : view && view.type !== 'thread' && view.channelId === ch.id
    const count = connectedCount(ch.id)
    const isDrop = dropTarget && dropTarget.kind === 'channel' && dropTarget.id === ch.id
    const cls = [
      'channel',
      active ? (isVoice ? 'active voice-active' : 'active') : '',
      isDrop ? 'drop-before' : '',
      dragChannel && dragChannel.id === ch.id ? 'dragging' : ''
    ].filter(Boolean).join(' ')
    return (
      <button
        key={ch.id}
        className={cls}
        draggable={!!canManage}
        onClick={() => (isVoice ? (active ? onLeaveVoice() : onJoinVoice(ch.id)) : onSelectChannel(ch.id))}
        onContextMenu={(e) => {
          if (isVoice || !canManage) return
          e.preventDefault()
          setThreadMenu(null)
          setChannelMenu({ x: e.clientX, y: e.clientY, ch })
        }}
        onDragStart={(e) => {
          if (!canManage) return
          e.stopPropagation()
          setDragCategory(null)
          setDragChannel({ id: ch.id, categoryId: ch.categoryId || null })
          setDropTarget(null)
        }}
        onDragEnd={() => { setDragChannel(null); setDragCategory(null); setDropTarget(null) }}
        onDragOver={(e) => {
          if (!dragChannel) return
          e.preventDefault()
          e.stopPropagation()
          if (!dropTarget || dropTarget.kind !== 'channel' || dropTarget.id !== ch.id) {
            setDropTarget({ kind: 'channel', id: ch.id })
          }
        }}
        onDrop={(e) => {
          if (!dragChannel) return
          e.preventDefault()
          e.stopPropagation()
          handleChannelDrop({ kind: 'channel', id: ch.id, categoryId: ch.categoryId || null })
        }}
      >
        <span className={`hash ${isVoice && speakingCount(ch.id) > 0 ? 'speaking' : ''}`}>
          {isVoice ? <VolumeIcon size={18} /> : '#'}
        </span>
        <span className="channel-name">{ch.name}</span>
        {!isVoice && unread[`ch:${ch.id}`] && <span className="unread-dot" />}
        {isVoice && count > 0 && <span className="voice-count">{count}</span>}
        {isVoice && active && <span className="voice-live">● LIVE</span>}
      </button>
    )
  }

  const renderCategorySection = (cat) => {
    const isCollapsed = !!collapsed[cat.id]
    const isCatDrop = dropTarget && dropTarget.kind === 'cat' && dropTarget.id === cat.id
    return (
      <div
        key={cat.id}
        className={`category-section ${isCatDrop && dragChannel ? 'drop-target' : ''}`}
        onDragOver={(e) => {
          if (!dragChannel || dragChannel.categoryId === cat.id) return
          e.preventDefault()
          e.stopPropagation()
          if (!dropTarget || dropTarget.kind !== 'cat' || dropTarget.id !== cat.id) {
            setDropTarget({ kind: 'cat', id: cat.id })
          }
        }}
        onDrop={(e) => {
          if (!dragChannel) return
          e.preventDefault()
          e.stopPropagation()
          handleChannelDrop({ kind: 'cat', id: cat.id })
        }}
      >
        <div
          className="category-header"
          draggable={!!canManage}
          onClick={() => setCollapsed((s) => ({ ...s, [cat.id]: !isCollapsed }))}
          onDragStart={(e) => {
            if (!canManage) return
            e.preventDefault()
            setDragChannel(null)
            setDragCategory(cat)
            setDropTarget(null)
          }}
          onDragEnd={() => { setDragCategory(null); setDropTarget(null) }}
          onDragOver={(e) => {
            if (!dragCategory || dragCategory.id === cat.id) return
            e.preventDefault()
            e.stopPropagation()
            if (!dropTarget || dropTarget.kind !== 'cat' || dropTarget.id !== cat.id) {
              setDropTarget({ kind: 'cat', id: cat.id })
            }
          }}
          onDrop={(e) => {
            if (!dragCategory || dragCategory.id === cat.id) return
            e.preventDefault()
            e.stopPropagation()
            handleCategoryDrop(cat.id)
          }}
        >
          <span className="cat-chevron">{isCollapsed ? '▸' : '▾'}</span>
          <span className="cat-name">{cat.name}</span>
          {canManage && !isCollapsed && (
            <span className="cat-plus" title="Create Channel" onClick={(e) => { e.stopPropagation(); onCreateChannel(cat.id) }}>＋</span>
          )}
        </div>
        {!isCollapsed && (
          <div className="category-channels">
            {cat.text.map(renderChannel)}
            {cat.voice.map(renderChannel)}
            {cat.text.length + cat.voice.length === 0 && canManage && (
              <button className="channel channel-empty-drop" onClick={() => onCreateChannel(cat.id)}>
                <span className="hash">#</span>
                <span className="channel-name">Create channel in {cat.name}</span>
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  const handleChannelDrop = async (target) => {
    if (!dragChannel) return
    const moved = dragChannel.id
    const movingCh = channels.find((c) => c.id === moved)
    if (!movingCh) { setDragChannel(null); setDropTarget(null); return }
    const list = channels.filter((c) => c.id !== moved)

    let newCategoryId = dragChannel.categoryId
    let insertIndex = list.length
    if (target.kind === 'channel') {
      newCategoryId = target.categoryId
      const tIdx = list.findIndex((c) => c.id === target.id)
      insertIndex = tIdx === -1 ? list.length : tIdx
    } else if (target.kind === 'cat') {
      newCategoryId = target.id
      const catIdx = categories.findIndex((c) => c.id === target.id)
      const prevCats = categories.slice(0, catIdx)
      let lastPrev = -1
      for (const pc of prevCats) {
        const pcs = list.filter((c) => (c.categoryId || null) === pc.id)
        if (pcs.length) lastPrev = list.indexOf(pcs[pcs.length - 1])
      }
      insertIndex = lastPrev + 1
    } else if (target.kind === 'uncat') {
      newCategoryId = null
      const first = list.findIndex((c) => !c.categoryId)
      insertIndex = first === -1 ? list.length : first
    }

    list.splice(Math.min(insertIndex, list.length), 0, { ...movingCh, categoryId: newCategoryId })
    const orderedIds = list.map((c) => c.id)
    const moves = newCategoryId !== dragChannel.categoryId ? [{ id: moved, categoryId: newCategoryId }] : []
    setDragChannel(null)
    setDropTarget(null)
    try {
      await onReorderChannels(orderedIds, moves)
    } catch (err) {
      alert(err.message || 'Failed to reorder channels')
    }
  }

  const handleCategoryDrop = async (targetId) => {
    if (!dragCategory) return
    const list = [...categories]
    const from = list.findIndex((c) => c.id === dragCategory.id)
    const to = list.findIndex((c) => c.id === targetId)
    setDragCategory(null)
    setDropTarget(null)
    if (from === -1 || to === -1 || from === to) return
    list.splice(from, 1)
    list.splice(to, 0, dragCategory)
    try {
      await onReorderCategories(list.map((c) => c.id))
    } catch (err) {
      alert(err.message || 'Failed to reorder categories')
    }
  }

  const renderUncat = (textList, voiceList) => {
    const count = textList.length + voiceList.length
    return (
      <div
        className="channel-section uncategorized"
        onDragOver={(e) => {
          if (!dragChannel) return
          e.preventDefault()
          if (!dropTarget || dropTarget.kind !== 'uncat') setDropTarget({ kind: 'uncat' })
        }}
        onDrop={(e) => {
          if (!dragChannel) return
          e.preventDefault()
          handleChannelDrop({ kind: 'uncat' })
        }}
      >
        {categories.length === 0 && <div className="section-header">Text Channels</div>}
        {textList.map(renderChannel)}
        {categories.length === 0 && <div className="section-header voice-header">Voice Channels</div>}
        {voiceList.map(renderChannel)}
        {count === 0 && canManage && (
          <button className="channel channel-empty-drop" onClick={() => onCreateChannel('')}>
            <span className="hash">#</span>
            <span className="channel-name">Create channel</span>
          </button>
        )}
        {categories.length > 0 && count > 0 && canManage && (
          <button className="channel channel-empty-drop" onClick={() => onCreateChannel('')}>
            <span className="hash">#</span>
            <span className="channel-name">Create channel</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="sidebar">
      {inServer && server ? (
        <>
          {server.banner && <div className="server-banner">{server.banner}</div>}
          <div className="sidebar-header" onClick={() => setServerMenu((v) => !v)}>
            <span>{server.name}</span>
            <span className="chevron">⌄</span>
            {serverMenu && (
              <div className="server-menu" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setServerMenu(false); onInvite() }}>+ Invite People</button>
                <button onClick={() => { setServerMenu(false); onCreateChannel() }}>+ Create Channel</button>
                {(server.isOwner || server.isAdmin) && (
                  <button onClick={() => { setServerMenu(false); onServerSettings() }}>
                    <GearIcon size={16} /> Server Settings
                  </button>
                )}
                <button className="leave" onClick={() => { setServerMenu(false); onLeaveServer() }}>
                  Leave Server
                </button>
              </div>
            )}
          </div>
          <div className="sidebar-scroll">
            {grouped.map(renderCategorySection)}
            {renderUncat(uncatText, uncatVoice)}
            {threads.length > 0 && (
              <div className="channel-section">
                <div className="section-header">Threads</div>
                {threads.map((t) => {
                  const isMember = t.memberIds && t.memberIds.includes(user.id)
                  return (
                    <button
                      key={t.id}
                      className={`dm-item thread-item ${view && view.type === 'thread' && view.threadId === t.id ? 'active' : ''} ${isMember ? '' : 'not-member'}`}
                      onClick={() => onSelectThread(t.id)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setThreadMenu({ x: e.clientX, y: e.clientY, t })
                      }}
                      title={t.name}
                    >
                      <span className="hash thread-icon"><ThreadIcon size={16} /></span>
                      <span className="dm-name">{t.name}</span>
                      <span className="thread-count">{t.messageCount}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          {myVoice && (
            <div className="voice-connected">
              <div className="vc-title">Voice Connected</div>
              <div className="vc-row">
                <span className="vc-name">{server && server.channels ? (server.channels.find((c) => c.id === myVoice.channelId)?.name || 'Voice') : 'Voice'}</span>
                <button className="vc-leave" onClick={onLeaveVoice} title="Disconnect"><CloseIcon size={16} /></button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="sidebar-header">
            <span>Direct Messages</span>
          </div>
          <div className="sidebar-scroll">
            <div className="channel-section">
              <button className={`dm-item friends-entry ${!view ? 'active' : ''}`} onClick={onHome}>
                <span className="friends-home-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                    <path d="M13 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                    <path d="M3 5v-.75C3 3.56 3.56 3 4.25 3s1.24.56 1.33 1.25C6.12 8.65 9.46 12 13 12h1a8 8 0 0 1 8 8 2 2 0 0 1-2 2 .21.21 0 0 1-.2-.15 7.65 7.65 0 0 0-1.32-2.3c-.15-.2-.42-.06-.39.17l.25 2c.02.15-.1.28-.25.28H9a2 2 0 0 1-2-2v-2.22c0-1.57-.67-3.05-1.53-4.37A15.85 15.85 0 0 1 3 5Z" />
                  </svg>
                </span>
                <span className="dm-name">Friends</span>
              </button>
              <div className="section-header" title="Create a direct message">
                Direct Messages
                <span className="plus" onClick={onCreateDm}>＋</span>
              </div>
              {dms.map((dm) => (
                <button
                  key={dm.id}
                  className={`dm-item ${view && view.type === 'dm' && view.dmId === dm.id ? 'active' : ''}`}
                  onClick={() => onSelectDm(dm.id)}
                >
                  <Avatar user={dm.recipient} size={32} showStatus />
                  <span className="dm-name">{dm.recipient.username}</span>
                  {unread[`dm:${dm.id}`] && <span className="unread-dot" />}
                </button>
              ))}
              {dms.length === 0 && <div className="sidebar-empty">No direct messages yet</div>}
            </div>
          </div>
        </>
      )}

      <div className="user-panel">
        <button className="user-avatar-btn" title="View your profile" onClick={() => setSelfPopout(true)}>
          <Avatar user={user} size={32} showStatus border="var(--bg-userpanel)" />
        </button>
        <div className="info" onClick={() => setUserMenu((v) => !v)}>
          <div className="username">{user.username}</div>
          <div className="tag">{user.customStatus || user.status}</div>
        </div>
        <div className="actions">
          <button
            className={`act ${user.status === 'dnd' ? 'active' : ''}`}
            title="Do Not Disturb"
            onClick={() => onUpdateStatus(user.status === 'dnd' ? 'online' : 'dnd')}
          >
            {user.status === 'dnd' ? <CloseIcon size={18} /> : <SmileIcon size={18} />}
          </button>
          <button className="act" title="User Settings" onClick={onSettings}>
            <GearIcon size={18} />
          </button>
        </div>
        {selfPopout && (
          <>
            <div className="popout-backdrop" onClick={() => setSelfPopout(false)} />
            <div className="user-popout">
              <ProfilePopout
                user={user}
                isMe
                friendState="none"
                onClose={() => setSelfPopout(false)}
                onEditProfile={() => { setSelfPopout(false); onEditProfile && onEditProfile() }}
              />
            </div>
          </>
        )}
        {userMenu && (
          <div className="user-menu" onClick={(e) => e.stopPropagation()}>
            {['online', 'idle', 'dnd'].map((s) => (
              <button key={s} onClick={() => { onUpdateStatus(s); setUserMenu(false) }}>
                <span className="presence-dot" style={{ background: `var(--${s})`, width: 12, height: 12, borderRadius: '50%', display: 'inline-block' }} />
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <button className="danger" onClick={() => { setUserMenu(false); onLogout() }}>
              <LogOutIcon size={16} /> Log Out
            </button>
          </div>
        )}
      </div>

      {threadMenu && (
        <div className="thread-menu" style={{ left: Math.min(threadMenu.x, window.innerWidth - 230), top: threadMenu.y }} onClick={(e) => e.stopPropagation()}>
          <div className="thread-menu-title">{threadMenu.t.name}</div>
          {!threadMenu.t.memberIds.includes(user.id) ? (
            <button onClick={() => { const id = threadMenu.t.id; setThreadMenu(null); onThreadAction(id, 'join') }}><PlusIcon size={16} /> Join Thread</button>
          ) : (
            <button onClick={() => { const id = threadMenu.t.id; setThreadMenu(null); onThreadAction(id, 'leave') }}><DoorOpenIcon size={16} /> Leave Thread</button>
          )}
          {(canManage || threadMenu.t.ownerId === user.id) && (
            <button onClick={() => { const id = threadMenu.t.id; setThreadMenu(null); onThreadAction(id, 'rename') }}><PencilIcon size={16} /> Rename Thread</button>
          )}
          {canManage && (
            <>
              <button onClick={() => { const id = threadMenu.t.id; const archived = threadMenu.t.archived; setThreadMenu(null); onThreadAction(id, archived ? 'unarchive' : 'archive') }}>
                <ArchiveIcon size={16} /> {threadMenu.t.archived ? 'Unarchive Thread' : 'Archive Thread'}
              </button>
              <button className="danger" onClick={() => { const id = threadMenu.t.id; setThreadMenu(null); onThreadAction(id, 'delete') }}>
                <TrashIcon size={16} /> Delete Thread
              </button>
            </>
          )}
        </div>
      )}
      {threadMenu && (
        <div className="popout-backdrop" onClick={() => setThreadMenu(null)} />
      )}

      {channelMenu && (
        <div className="thread-menu channel-menu" style={{ left: Math.min(channelMenu.x, window.innerWidth - 230), top: channelMenu.y }} onClick={(e) => e.stopPropagation()}>
          <div className="thread-menu-title">#{channelMenu.ch.name}</div>
          {canManage && (
            <>
              <button onClick={() => { const id = channelMenu.ch.id; setChannelMenu(null); onChannelAction(id, 'rename') }}><PencilIcon size={16} /> Rename Channel</button>
              <button onClick={() => { const id = channelMenu.ch.id; setChannelMenu(null); onChannelAction(id, 'topic') }}><FileTextIcon size={16} /> Edit Topic</button>
              <button className="danger" onClick={() => { const id = channelMenu.ch.id; setChannelMenu(null); onChannelAction(id, 'delete') }}>
                <TrashIcon size={16} /> Delete Channel
              </button>
            </>
          )}
        </div>
      )}
      {channelMenu && (
        <div className="popout-backdrop" onClick={() => setChannelMenu(null)} />
      )}
    </div>
  )
}

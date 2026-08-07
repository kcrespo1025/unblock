import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { api, getToken, setToken, setOnAuthError, isStandalone } from './api.js'
import { createLocalSocket } from './standalone/localServer.js'
import { loadCache, saveCache, clearCache, loadOutbox, saveOutbox } from './cache.js'
import AuthScreen from './components/AuthScreen.jsx'
import ServerRail from './components/ServerRail.jsx'
import Sidebar from './components/Sidebar.jsx'
import ChatView from './components/ChatView.jsx'
import MemberList from './components/MemberList.jsx'
import FriendsView from './components/FriendsView.jsx'
import PinsDrawer from './components/PinsDrawer.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import Splash from './components/Splash.jsx'
import { CreateServerModal, CreateChannelModal, DmModal, InviteModal } from './components/Modals.jsx'
import JoinServerModal from './components/JoinServerModal.jsx'
import ServerSettingsModal from './components/ServerSettingsModal.jsx'
import QuickSwitcher from './components/QuickSwitcher.jsx'
import InboxPanel from './components/InboxPanel.jsx'
import Avatar from './components/Avatar.jsx'
import { soundPing, soundJoin, soundLeave, unlockAudio, soundRing, soundCallConnected, soundCallEnded, soundCallDecline } from './sounds.js'
import { CallEngine, rtcSupported, isSecureContext } from './webrtc.js'
import { VoiceChannelView, DmCallView, IncomingCallOverlay, VoiceBanner } from './components/CallView.jsx'
import { applyAppSettings, readCfg } from './themes.js'
import { ThreadIcon, SearchIcon, CloseIcon } from './icons.jsx'

const keyFor = (target) => (target.type === 'channel' ? `ch:${target.id}` : `dm:${target.id}`)

let nonceCounter = 0
const nextNonce = () => `n${Date.now()}_${++nonceCounter}`

function isNetworkError(err) {
  return err instanceof TypeError
}

const cached = loadCache()

export default function App() {
  const [token, setTokenState] = useState(() => getToken())
  const [me, setMe] = useState(() => cached?.me || null)
  const [servers, setServers] = useState(() => cached?.servers || [])
  const [dms, setDms] = useState(() => cached?.dms || [])
  const [view, setView] = useState(null)
  const [messages, setMessages] = useState(() => cached?.messages || {})
  const [typing, setTyping] = useState({})
  const [unread, setUnread] = useState({})
  const [presences, setPresences] = useState(() => cached?.presences || {})
  const [membersVisible, setMembersVisible] = useState(true)
  const [modal, setModal] = useState(null)
  const [channelModalCat, setChannelModalCat] = useState(null)
  const [loadedKeys, setLoadedKeys] = useState({})
  const [online, setOnline] = useState(false)
  const [outbox, setOutbox] = useState(() => loadOutbox())
  const [syncing, setSyncing] = useState(false)
  const [booting, setBooting] = useState(true)

  const [friends, setFriends] = useState({ friends: [], incoming: [], outgoing: [] })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState('appearance')
  const [pinsOpen, setPinsOpen] = useState(false)
  const [pinsCache, setPinsCache] = useState({})
  const [voiceChannels, setVoiceChannels] = useState({})
  const [myVoice, setMyVoice] = useState(null)
  const [speakingMap, setSpeakingMap] = useState({})
  const [dmCall, setDmCall] = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const [callParticipants, setCallParticipants] = useState({})
  const [selfMedia, setSelfMedia] = useState({ audio: false, camera: false, screen: false })
  const [selfMuted, setSelfMuted] = useState(false)
  const [selfDeafened, setSelfDeafened] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const [scrollTarget, setScrollTarget] = useState(null)
  const [serverSettingsOpen, setServerSettingsOpen] = useState(false)
  const [hasMoreMap, setHasMoreMap] = useState({})
  const [quickOpen, setQuickOpen] = useState(false)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [inbox, setInbox] = useState([])
  const [inboxSeen, setInboxSeen] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('underground_inbox_seen_v1') || '[]')) } catch { return new Set() }
  })

  const socketRef = useRef(null)
  const serversRef = useRef(servers)
  serversRef.current = servers
  const viewRef = useRef(view)
  viewRef.current = view
  const meRef = useRef(me)
  meRef.current = me
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const outboxRef = useRef(outbox)
  outboxRef.current = outbox
  const inboxRef = useRef(inbox)
  inboxRef.current = inbox
  const dmsRef = useRef(dms)
  dmsRef.current = dms
  const friendsRef = useRef(friends)
  friendsRef.current = friends
  const myVoiceRef = useRef(null)
  const dmCallRef = useRef(null)
  const incomingCallRef = useRef(null)
  const engineRef = useRef(null)
  const ringTimerRef = useRef(null)
  const callParticipantsRef = useRef(callParticipants)
  callParticipantsRef.current = callParticipants
  const findUserRef = useRef(() => null)

  const currentTarget = useMemo(() => {
    if (!view) return null
    if (view.type === 'server') return { type: 'channel', id: view.channelId }
    if (view.type === 'thread') return { type: 'channel', id: view.threadId }
    if (view.type === 'dm') return { type: 'dm', id: view.dmId }
    return null
  }, [view])

  const withPresence = useCallback((u) => {
    if (!u) return u
    const p = presences[u.id]
    return p ? { ...u, ...p } : u
  }, [presences])

  const applyMessageUpdate = useCallback((key, updater) => {
    setMessages((prev) => {
      const list = prev[key] || []
      const next = updater(list)
      if (next === list) return prev
      return { ...prev, [key]: next }
    })
  }, [])

  const updateOutbox = useCallback((updater) => {
    setOutbox((prev) => {
      const next = updater(prev)
      outboxRef.current = next
      saveOutbox(next)
      return next
    })
  }, [])

  const unauthorizedRef = useRef(false)
  const handleUnauthorized = useCallback(() => {
    if (unauthorizedRef.current) return
    unauthorizedRef.current = true
    try { socketRef.current?.disconnect() } catch { /* noop */ }
    socketRef.current = null
    clearCache()
    updateOutbox(() => [])
    setToken('')
    setTokenState('')
    setMe(null)
    setServers([])
    setDms([])
    setMessages({})
    setPresences({})
    setView(null)
    setFriends({ friends: [], incoming: [], outgoing: [] })
    setSettingsOpen(false)
    setSettingsTab('appearance')
    setPinsOpen(false)
    setModal(null)
    setServerSettingsOpen(false)
    setMyVoice(null)
    stopRing()
    engineRef.current?.close()
    clearCallState()
    setBooting(false)
    setTimeout(() => { unauthorizedRef.current = false }, 1200)
  }, [updateOutbox])

  useEffect(() => {
    setOnAuthError(handleUnauthorized)
    return () => setOnAuthError(null)
  }, [handleUnauthorized])

  useEffect(() => {
    if (!me) return
    const timer = setTimeout(() => {
      saveCache({
        me,
        servers,
        dms,
        messages,
        presences,
        savedAt: new Date().toISOString()
      })
    }, 400)
    return () => clearTimeout(timer)
  }, [me, servers, dms, messages, presences])

  useEffect(() => {
    applyAppSettings()
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setQuickOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const refreshFriends = useCallback(async () => {
    try {
      setFriends(await api('/friends'))
    } catch (err) {
      console.error('refresh friends (offline?)', err)
    }
  }, [])

  const refreshServers = useCallback(async () => {
    try {
      setServers(await api('/servers'))
    } catch (err) {
      console.error('refresh servers (offline?)', err)
    }
  }, [])

  const refreshDms = useCallback(async () => {
    try {
      setDms(await api('/dms'))
    } catch (err) {
      console.error('refresh dms (offline?)', err)
    }
  }, [])

  const refreshPins = useCallback(async (target) => {
    const key = keyFor(target)
    try {
      const data = await api(`/channels/${target.id}/pins`)
      setPinsCache((prev) => ({ ...prev, [key]: data.messages }))
    } catch {
      /* offline */
    }
  }, [])

  const refreshInbox = useCallback(async () => {
    try {
      const data = await api('/inbox')
      setInbox(data.notifications || [])
    } catch {
      /* offline */
    }
  }, [])

  const markInboxSeen = useCallback(() => {
    setInboxSeen((prev) => {
      const next = new Set([...prev])
      for (const n of inboxRef.current || []) next.add(n.id)
      try { localStorage.setItem('underground_inbox_seen_v1', JSON.stringify([...next])) } catch { /* noop */ }
      return next
    })
  }, [])

  const loadTargetMessages = useCallback(async (target) => {
    if (!target) return
    const key = keyFor(target)
    setLoadedKeys((prev) => ({ ...prev, [key]: 'loading' }))
    try {
      const path = target.type === 'channel' ? `/channels/${target.id}/messages` : `/dm/${target.id}/messages`
      const data = await api(path)
      setMessages((prev) => ({ ...prev, [key]: data.messages }))
      setHasMoreMap((prev) => ({ ...prev, [key]: !!data.hasMore }))
      setLoadedKeys((prev) => ({ ...prev, [key]: 'done' }))
      await refreshPins(target)
    } catch (err) {
      console.error('load messages (offline?)', err)
      setLoadedKeys((prev) => ({ ...prev, [key]: 'error' }))
    }
  }, [refreshPins])

  const loadEarlier = useCallback(async (target) => {
    if (!target) return
    const key = keyFor(target)
    const list = messagesRef.current[key] || []
    const first = list[0]
    if (!first || first.pending) return
    const before = first.id
    try {
      const path = target.type === 'channel' ? `/channels/${target.id}/messages` : `/dm/${target.id}/messages`
      const data = await api(`${path}?before=${encodeURIComponent(before)}`)
      setMessages((prev) => {
        const cur = prev[key] || []
        const existing = new Set(cur.map((m) => m.id))
        const older = (data.messages || []).filter((m) => !existing.has(m.id))
        return older.length ? { ...prev, [key]: [...older, ...cur] } : prev
      })
      setHasMoreMap((prev) => ({ ...prev, [key]: !!data.hasMore }))
    } catch (err) {
      console.error('load earlier (offline?)', err)
    }
  }, [])

  const joinRoom = useCallback((target) => {
    if (target && socketRef.current) {
      socketRef.current.emit('room:join', { target })
    }
  }, [])

  const markRead = useCallback((key) => {
    setUnread((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const flushOutbox = useCallback((onDone) => {
    const socket = socketRef.current
    if (!socket || !socket.connected || outboxRef.current.length === 0) {
      onDone && onDone()
      return
    }
    const queue = [...outboxRef.current]
    updateOutbox(() => [])
    setSyncing(true)
    const runNext = (list) => {
      if (!list.length) {
        setSyncing(false)
        onDone && onDone()
        return
      }
      const op = list[0]
      const rest = list.slice(1)
      socket.emit(op.type, op.payload, (res) => {
        if (!res || res.error) {
          updateOutbox((prev) => [...prev, op])
        }
        runNext(rest)
      })
    }
    runNext(queue)
  }, [updateOutbox])

  useEffect(() => {
    if (!token) {
      setOnline(false)
      setBooting(false)
      return
    }

    let cancelled = false
    const socket = isStandalone() ? createLocalSocket({ auth: { token } }) : io({ auth: { token } })
    socketRef.current = socket

    socket.on('connect', () => {
      setOnline(true)
      flushOutbox(() => {
        refreshServers()
        refreshDms()
        refreshFriends()
        refreshInbox()
        loadTargetMessages(viewRef.current && (viewRef.current.type === 'server'
          ? { type: 'channel', id: viewRef.current.channelId }
          : { type: 'dm', id: viewRef.current.dmId }))
      })
    })
    socket.on('disconnect', () => setOnline(false))
    socket.on('connect_error', (err) => {
      setOnline(false)
      if (err && err.message === 'Not authenticated') handleUnauthorized()
    })

    const setup = async () => {
      try {
        const { user } = await api('/me')
        if (cancelled) return
        setMe(user)
        setPresences((prev) => ({ ...prev, [user.id]: { online: true, status: user.status } }))
        await Promise.all([refreshServers(), refreshDms(), refreshFriends(), refreshInbox()])
        setBooting(false)
      } catch (err) {
        if (cancelled) return
        if (isNetworkError(err)) {
          setOnline(false)
          setBooting(false)
          return
        }
        if (err.auth) return
        handleUnauthorized()
      }
    }
    setup()

    const mentionsMe = (msg) =>
      msg.content && (msg.content.includes(`@${meRef.current?.username}`) || msg.content.includes('@everyone') || msg.content.includes('@here'))

    socket.on('chat:message', (msg) => {
      const key = keyFor(msg.target)
      applyMessageUpdate(key, (list) => [...list, msg])
      const cur = viewRef.current
      const isCurrent =
        (cur && msg.target.type === 'channel' && cur.type === 'server' && cur.channelId === msg.target.id) ||
        (cur && msg.target.type === 'channel' && cur.type === 'thread' && cur.threadId === msg.target.id) ||
        (cur && msg.target.type === 'dm' && cur.type === 'dm' && cur.dmId === msg.target.id)
      refreshInbox()
      if (!isCurrent) {
        setUnread((prev) => ({ ...prev, [key]: true }))
        if (msg.author.id !== meRef.current?.id && mentionsMe(msg)) {
          if (readCfg('notif_sound_mention', '1') === '1') soundPing()
          if (readCfg('notif_desktop', '0') === '1' && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`Underground — @${msg.author.username}`, { body: msg.content.slice(0, 140) })
            } catch { /* noop */ }
          }
        }
      } else {
        setTyping((prev) => (prev[key] ? { ...prev, [key]: [] } : prev))
      }
    })

    socket.on('chat:ack', (payload) => {
      const key = keyFor(payload.target)
      applyMessageUpdate(key, (list) =>
        list.map((m) => (m.nonce === payload.nonce ? { ...payload.message, nonce: payload.nonce } : m))
      )
    })

    socket.on('chat:edit', (payload) => {
      const key = keyFor(payload.target)
      applyMessageUpdate(key, (list) =>
        list.map((m) => (m.id === payload.messageId ? { ...m, content: payload.content, edited: true } : m))
      )
    })

    socket.on('chat:delete', (payload) => {
      const key = keyFor(payload.target)
      applyMessageUpdate(key, (list) => list.filter((m) => m.id !== payload.messageId))
    })

    socket.on('react', (payload) => {
      const key = keyFor(payload.target)
      applyMessageUpdate(key, (list) =>
        list.map((m) => {
          if (m.id !== payload.messageId) return m
          const reactions = { ...(m.reactions || {}) }
          if (payload.add) {
            const ids = new Set(reactions[payload.emoji] || [])
            ids.add(payload.userId)
            reactions[payload.emoji] = [...ids]
          } else {
            const ids = (reactions[payload.emoji] || []).filter((id) => id !== payload.userId)
            if (ids.length) reactions[payload.emoji] = ids
            else delete reactions[payload.emoji]
          }
          return { ...m, reactions }
        })
      )
    })

    socket.on('typing', (payload) => {
      const key = keyFor(payload.target)
      const cur = viewRef.current
      const isCurrent =
        (cur && payload.target.type === 'channel' && cur.type === 'server' && cur.channelId === payload.target.id) ||
        (cur && payload.target.type === 'channel' && cur.type === 'thread' && cur.threadId === payload.target.id) ||
        (cur && payload.target.type === 'dm' && cur.type === 'dm' && cur.dmId === payload.target.id)
      if (!isCurrent) return
      setTyping((prev) => {
        const list = prev[key] || []
        if (list.some((t) => t.userId === payload.userId)) return prev
        return { ...prev, [key]: [...list, { userId: payload.userId, username: payload.username }] }
      })
    })

    socket.on('typing:clear', (payload) => {
      const key = keyFor(payload.target)
      setTyping((prev) => {
        const list = (prev[key] || []).filter((t) => t.userId !== payload.userId)
        if (list.length === (prev[key] || []).length) return prev
        return { ...prev, [key]: list }
      })
    })

    socket.on('presence', (payload) => {
      setPresences((prev) => ({ ...prev, [payload.userId]: payload }))
    })

    socket.on('server:created', refreshServers)
    socket.on('server:membership', refreshServers)

    socket.on('server:updated', async (payload) => {
      await refreshServers()
      const cur = viewRef.current
      if (cur && cur.type === 'server' && cur.serverId === payload.serverId) {
        const s = serversRef.current.find((x) => x.id === payload.serverId)
        if (s && !s.channels.some((c) => c.id === cur.channelId)) {
          const firstText = s.channels.find((c) => c.type !== 'voice') || s.channels[0]
          if (firstText) setView({ type: 'server', serverId: s.id, channelId: firstText.id })
        }
      }
    })

    socket.on('server:deleted', (payload) => {
      if (myVoiceRef.current && myVoiceRef.current.serverId === payload.serverId) leaveVoice(true)
      const cur = viewRef.current
      if (cur && cur.type === 'server' && cur.serverId === payload.serverId) {
        setView(null)
        setMembersVisible(false)
      }
      refreshServers()
    })

    socket.on('server:kicked', (payload) => {
      if (myVoiceRef.current && myVoiceRef.current.serverId === payload.serverId) leaveVoice(true)
      const cur = viewRef.current
      if (cur && cur.type === 'server' && cur.serverId === payload.serverId) {
        setView(null)
        setMembersVisible(false)
        alert(payload.banned ? 'You were banned from this server.' : 'You were kicked from this server.')
      }
      refreshServers()
    })
    socket.on('server:joined', async (payload) => {
      await refreshServers()
      const s = serversRef.current.find((x) => x.id === payload.serverId)
      if (s && s.channels.length) {
        const firstText = s.channels.find((c) => c.type !== 'voice') || s.channels[0]
        setView({ type: 'server', serverId: s.id, channelId: firstText.id })
      }
    })
    socket.on('friendship:update', refreshFriends)

    socket.on('pin:update', (payload) => {
      const key = keyFor(payload.target)
      applyMessageUpdate(key, (list) =>
        list.map((m) => (m.id === payload.messageId ? { ...m, pinned: payload.pinned } : m))
      )
      refreshPins(payload.target)
    })

    socket.on('thread:update', () => refreshServers())

    socket.on('voice:state', (payload) => {
      setVoiceChannels((prev) => ({ ...prev, [payload.serverId]: payload.channels || {} }))
      const v = myVoiceRef.current
      if (!v || v.serverId !== payload.serverId) return
      const ids = (payload.channels && payload.channels[v.channelId]) || []
      const engine = engineRef.current
      if (engine && engine.roomId) {
        for (const id of engine.peerIds()) {
          if (id !== meRef.current?.id && !ids.includes(id)) engine.disconnectPeer(id)
        }
      }
      setCallParticipants((prev) => {
        const next = {}
        let changed = false
        for (const [id, p] of Object.entries(prev)) {
          if (id === meRef.current?.id || ids.includes(id)) next[id] = p
          else changed = true
        }
        for (const id of ids) {
          if (id === meRef.current?.id || next[id]) continue
          next[id] = { user: findUserRef.current(id), connected: false }
          changed = true
        }
        return changed ? next : prev
      })
    })

    socket.on('voice:speaking', (payload) => {
      setSpeakingMap((prev) => ({ ...prev, [payload.userId]: payload.speaking }))
    })

    socket.on('call:invite', (payload) => {
      if (!payload || !payload.user || !payload.call) return
      if (dmCallRef.current || incomingCallRef.current) {
        socket.emit('call:decline', { to: payload.from, roomId: payload.call.roomId })
        return
      }
      setIncomingCall({ roomId: payload.call.roomId, dmId: payload.call.dmId || null, from: payload.from, user: payload.user })
      try { soundRing() } catch { /* noop */ }
      startRing()
      clearTimeout(incomingCallRef.current?.timer)
      incomingCallRef.current = { ...incomingCallRef.current, timer: setTimeout(() => {
        if (incomingCallRef.current) {
          const inc = incomingCallRef.current
          setIncomingCall(null)
          incomingCallRef.current = null
          stopRing()
          socket.emit('call:decline', { to: inc.from, roomId: inc.roomId })
        }
      }, 30000) }
    })

    socket.on('call:accept', (payload) => {
      const call = dmCallRef.current
      if (!call || String(payload.roomId) !== String(call.roomId)) return
      stopRing()
      setDmCall((prev) => (prev ? { ...prev, stage: 'connecting' } : prev))
      const engine = engineRef.current
      if (engine) {
        setCallParticipants((prev) => ({ ...prev, [payload.from]: { ...(prev[payload.from] || {}), user: payload.user, connected: false } }))
        engine.addExistingParticipant(payload.from, true)
      }
      try { soundCallConnected() } catch { /* noop */ }
    })

    socket.on('call:decline', (payload) => {
      const call = dmCallRef.current
      if (!call || String(payload.roomId) !== String(call.roomId)) return
      stopRing()
      try { soundCallDecline() } catch { /* noop */ }
      setDmCall((prev) => (prev ? { ...prev, stage: 'declined' } : prev))
      setTimeout(() => {
        if (dmCallRef.current && dmCallRef.current.stage === 'declined') endDmCall()
      }, 2600)
    })

    socket.on('call:leave', (payload) => {
      const inc = incomingCallRef.current
      if (inc && String(payload.roomId) === String(inc.roomId)) {
        stopRing()
        setIncomingCall(null)
        incomingCallRef.current = null
        try { soundCallEnded() } catch { /* noop */ }
        return
      }
      const call = dmCallRef.current
      if (!call || String(payload.roomId) !== String(call.roomId)) return
      stopRing()
      try { soundCallEnded() } catch { /* noop */ }
      endDmCall()
    })

    socket.on('call:signal', (payload) => {
      const engine = engineRef.current
      if (!engine) return
      const voiceMatch = engine.roomId && String(engine.roomId) === String(payload.roomId)
      const call = dmCallRef.current
      const dmMatch = call && String(call.roomId) === String(payload.roomId)
      if (!voiceMatch && !dmMatch) return
      if (!callParticipantsRef.current[payload.from]) {
        setCallParticipants((prev) => ({ ...prev, [payload.from]: { ...(prev[payload.from] || {}), user: findUserRef.current(payload.from), connected: false } }))
      }
      engine.onSignal(payload.from, payload.data)
    })

    return () => {
      cancelled = true
      socket.disconnect()
      socketRef.current = null
      stopRing()
      engineRef.current?.close()
    }
  }, [token, handleUnauthorized])

  useEffect(() => {
    if (currentTarget) {
      markRead(keyFor(currentTarget))
      joinRoom(currentTarget)
      if (online) loadTargetMessages(currentTarget)
    }
  }, [currentTarget, markRead, joinRoom, online, loadTargetMessages])

  const currentServer = useMemo(
    () => (view && (view.type === 'server' || view.type === 'thread' || view.type === 'voice') ? servers.find((s) => s.id === view.serverId) : null),
    [view, servers]
  )
  const currentChannel = useMemo(
    () => (currentServer ? currentServer.channels.find((c) => c.id === view.channelId) : null),
    [currentServer, view]
  )
  const currentThread = useMemo(
    () => (view && view.type === 'thread' && currentServer ? (currentServer.threads || []).find((t) => t.id === view.threadId) || null : null),
    [view, currentServer]
  )
  const currentDm = useMemo(
    () => (view && view.type === 'dm' ? dms.find((d) => d.id === view.dmId) : null),
    [view, dms]
  )

  useEffect(() => {
    if (view && view.type === 'thread' && currentServer) {
      const t = (currentServer.threads || []).find((x) => x.id === view.threadId)
      if (!t && view.channelId) {
        setView({ type: 'server', serverId: currentServer.id, channelId: view.channelId })
      }
    }
  }, [view, currentServer])

  const handleAuth = (data) => {
    setToken(data.token)
    setTokenState(data.token)
    setMe(data.user)
    setPresences({ [data.user.id]: { online: true, status: data.user.status } })
    refreshServers()
    refreshDms()
    refreshFriends()
    setBooting(false)
  }

  const handleLogout = async () => {
    try {
      await api('/logout', { method: 'POST' })
    } catch { /* noop */ }
    socketRef.current?.disconnect()
    clearCache()
    updateOutbox(() => [])
    stopRing()
    engineRef.current?.close()
    clearCallState()
    setToken('')
    setTokenState('')
    setMe(null)
    setServers([])
    setDms([])
    setMessages({})
    setView(null)
    setSettingsOpen(false)
    setServerSettingsOpen(false)
    setMyVoice(null)
  }

  const selectServer = (serverId) => {
    const s = servers.find((x) => x.id === serverId)
    if (!s || !s.channels.length) return
    const firstText = s.channels.find((c) => c.type !== 'voice') || s.channels[0]
    setView({ type: 'server', serverId, channelId: firstText.id })
    setMembersVisible(true)
  }

  const selectChannel = (channelId) => {
    if (!view || (view.type !== 'server' && view.type !== 'thread')) return
    const ch = currentServer && currentServer.channels.find((c) => c.id === channelId)
    if (ch && ch.type === 'voice') return
    setView(view.type === 'thread'
      ? { type: 'server', serverId: view.serverId, channelId }
      : { ...view, channelId })
  }

  const selectDm = (dmId) => {
    setView({ type: 'dm', dmId })
    setMembersVisible(false)
  }

  const selectThread = async (threadId, serverId) => {
    const s = serverId ? servers.find((x) => x.id === serverId) : currentServer
    if (!s) return
    const t = (s.threads || []).find((x) => x.id === threadId)
    if (!t) return
    if (!(t.memberIds || []).includes(me.id)) {
      try {
        await api(`/threads/${threadId}/join`, { method: 'POST' })
        await refreshServers()
      } catch { /* allow open attempt anyway */ }
    }
    setView({ type: 'thread', serverId: s.id, threadId: t.id, channelId: t.channelId })
    setMembersVisible(true)
  }

  const createThread = async (message) => {
    if (!view || view.type !== 'server' || !currentServer) return
    const name = window.prompt('Thread name (2-60 characters):', (message.content || '').slice(0, 40))
    if (!name) return
    try {
      const data = await api(`/channels/${view.channelId}/threads`, {
        method: 'POST',
        body: { name: name.trim(), messageId: message.id }
      })
      await refreshServers()
      if (data.thread) setView({ type: 'thread', serverId: currentServer.id, threadId: data.thread.id, channelId: view.channelId })
    } catch (err) {
      if (err.auth) return
      alert(err.message)
    }
  }

  const threadAction = async (threadId, action) => {
    if (!currentServer) return
    const t = (currentServer.threads || []).find((x) => x.id === threadId)
    if (!t) return
    try {
      if (action === 'join') {
        await api(`/threads/${threadId}/join`, { method: 'POST' })
      } else if (action === 'leave') {
        await api(`/threads/${threadId}/leave`, { method: 'POST' })
        if (view && view.type === 'thread' && view.threadId === threadId) setView({ type: 'server', serverId: currentServer.id, channelId: t.channelId })
      } else if (action === 'rename') {
        const name = window.prompt('Thread name (2-60 characters):', t.name)
        if (!name) return
        await api(`/threads/${threadId}`, { method: 'PATCH', body: { name: name.trim() } })
      } else if (action === 'archive' || action === 'unarchive') {
        await api(`/threads/${threadId}`, { method: 'PATCH', body: { archived: action === 'archive' } })
        if (action === 'archive' && view && view.type === 'thread' && view.threadId === threadId) {
          setView({ type: 'server', serverId: currentServer.id, channelId: t.channelId })
        }
      } else if (action === 'delete') {
        if (!window.confirm(`Delete thread “${t.name}” and all its messages?`)) return
        await api(`/threads/${threadId}`, { method: 'DELETE' })
        if (view && view.type === 'thread' && view.threadId === threadId) setView({ type: 'server', serverId: currentServer.id, channelId: t.channelId })
      }
      await refreshServers()
    } catch (err) {
      if (err.auth) return
      alert(err.message)
    }
  }

  const currentMessages = currentTarget ? (messages[keyFor(currentTarget)] || []) : []
  const currentTyping = currentTarget ? (typing[keyFor(currentTarget)] || []) : []
  const currentPins = currentTarget ? (pinsCache[keyFor(currentTarget)] || []) : []

  const sendMessage = (content, opts = {}) => {
    if (!currentTarget) return
    const nonce = nextNonce()
    const key = keyFor(currentTarget)
    const payload = { target: currentTarget, content, nonce }
    const pending = {
      id: nonce,
      nonce,
      pending: true,
      offline: !online,
      author: meRef.current,
      content,
      reactions: {},
      createdAt: new Date().toISOString()
    }
    if (opts.sticker) {
      pending.sticker = opts.sticker
      payload.sticker = opts.sticker
    }
    if (opts.replyTo) {
      const r = opts.replyTo
      pending.replyTo = { messageId: r.messageId, authorName: r.authorName, content: r.content }
      payload.replyTo = { messageId: r.messageId, channelId: currentTarget.id }
    }
    if (opts.attachment) {
      pending.attachment = opts.attachment
      payload.attachment = opts.attachment
    }
    applyMessageUpdate(key, (list) => [...list, pending])
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('chat:send', payload, (res) => {
        if (res && res.error) {
          alert(res.error)
          applyMessageUpdate(key, (list) => list.filter((m) => m.nonce !== nonce))
        }
      })
    } else {
      updateOutbox((prev) => [...prev, { type: 'chat:send', payload }])
    }
  }

  const emitTyping = () => {
    if (!socketRef.current || !socketRef.current.connected || !currentTarget) return
    const now = Date.now()
    if (now - (emitTyping.last || 0) < 1500) return
    emitTyping.last = now
    socketRef.current.emit('typing:start', { target: currentTarget })
  }

  const queueOrEmit = (type, payload, ack) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(type, payload, ack)
    } else {
      updateOutbox((prev) => [...prev, { type, payload }])
    }
  }

  const handleReact = (messageId, emoji) => {
    if (!currentTarget) return
    const list = messagesRef.current[keyFor(currentTarget)] || []
    const msg = list.find((m) => m.id === messageId)
    if (!msg || msg.pending) return
    const ids = (msg.reactions || {})[emoji] || []
    const add = !ids.includes(meRef.current.id)
    const payload = { target: currentTarget, messageId, emoji }
    applyMessageUpdate(keyFor(currentTarget), (l) =>
      l.map((m) => {
        if (m.id !== messageId) return m
        const reactions = { ...(m.reactions || {}) }
        if (add) {
          const set = new Set(reactions[emoji] || [])
          set.add(meRef.current.id)
          reactions[emoji] = [...set]
        } else {
          const ids = (reactions[emoji] || []).filter((id) => id !== meRef.current.id)
          if (ids.length) reactions[emoji] = ids
          else delete reactions[emoji]
        }
        return { ...m, reactions }
      })
    )
    queueOrEmit(add ? 'react:add' : 'react:remove', payload)
  }

  const handleEdit = (messageId, content) => {
    if (!currentTarget) return
    const list = messagesRef.current[keyFor(currentTarget)] || []
    const msg = list.find((m) => m.id === messageId)
    if (!msg || msg.pending) return
    applyMessageUpdate(keyFor(currentTarget), (l) =>
      l.map((m) => (m.id === messageId ? { ...m, content, edited: true } : m))
    )
    queueOrEmit('chat:edit', { target: currentTarget, messageId, content })
  }

  const handleDelete = (messageId) => {
    if (!currentTarget) return
    const list = messagesRef.current[keyFor(currentTarget)] || []
    const msg = list.find((m) => m.id === messageId)
    if (!msg || msg.pending) return
    applyMessageUpdate(keyFor(currentTarget), (l) => l.filter((m) => m.id !== messageId))
    queueOrEmit('chat:delete', { target: currentTarget, messageId })
  }

  const handlePin = (messageId) => {
    if (!currentTarget) return
    const key = keyFor(currentTarget)
    const list = messagesRef.current[key] || []
    const msg = list.find((m) => m.id === messageId)
    if (!msg || msg.pending) return
    const next = !msg.pinned
    applyMessageUpdate(key, (l) => l.map((m) => (m.id === messageId ? { ...m, pinned: next } : m)))
    setPinsCache((prev) => {
      const cur = prev[key] || []
      if (next) {
        if (cur.some((m) => m.id === messageId)) return prev
        return { ...prev, [key]: [...cur, { ...msg, pinned: true }] }
      }
      return { ...prev, [key]: cur.filter((m) => m.id !== messageId) }
    })
    queueOrEmit(next ? 'pin:add' : 'pin:remove', { target: currentTarget, messageId }, () => refreshPins(currentTarget))
  }

  const handleSearch = async (query) => {
    if (!currentTarget || currentTarget.type !== 'channel' || !query.trim()) return
    try {
      const data = await api(`/channels/${currentTarget.id}/search?q=${encodeURIComponent(query.trim())}`)
      setSearchResults({ query: query.trim(), messages: data.messages })
    } catch { /* noop */ }
  }

  const jumpTo = (messageId) => {
    setScrollTarget(messageId)
    setSearchResults(null)
  }

  const stopRing = useCallback(() => {
    if (ringTimerRef.current) {
      clearInterval(ringTimerRef.current)
      ringTimerRef.current = null
    }
  }, [])

  const startRing = useCallback(() => {
    stopRing()
    ringTimerRef.current = setInterval(() => {
      try { soundRing() } catch { /* noop */ }
    }, 1500)
  }, [stopRing])

  const getEngine = useCallback(() => {
    if (engineRef.current && !engineRef.current.closed) return engineRef.current
    engineRef.current = null
    const engine = new CallEngine({
      signal: (to, data) => {
        const roomId = engine.roomId
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('call:signal', { to, roomId, data })
        }
      },
      onSpeaking: (userId, speaking) => {
        setCallParticipants((prev) => {
          const cur = prev[userId]
          if (!cur || cur.speaking === speaking) return prev
          return { ...prev, [userId]: { ...cur, speaking } }
        })
        if (userId === meRef.current?.id) {
          setSpeakingMap((prev) => (prev[userId] === speaking ? prev : { ...prev, [userId]: speaking }))
          engine.broadcastSpeaking(speaking)
        }
      },
      onStream: (userId, stream, kind) => {
        setCallParticipants((prev) => ({ ...prev, [userId]: { ...(prev[userId] || {}), stream, kind } }))
      },
      onState: (userId, state) => {
        setCallParticipants((prev) => {
          const cur = prev[userId] || {}
          const connected = state === 'connected'
          if (cur.connected === connected && cur.connection === state) return prev
          return { ...prev, [userId]: { ...cur, connected, connection: state } }
        })
        if (state === 'connected' && dmCallRef.current && dmCallRef.current.stage === 'connecting') {
          setDmCall((prev) => {
            const next = prev ? { ...prev, stage: 'connected' } : prev
            dmCallRef.current = next
            return next
          })
        }
      }
    })
    engine.selfId = meRef.current?.id
    engineRef.current = engine
    return engine
  }, [])

  const findUser = useCallback((id) => {
    if (id === meRef.current?.id) return meRef.current
    for (const s of serversRef.current) {
      const m = (s.members || []).find((x) => x.id === id)
      if (m) return m
    }
    for (const d of dmsRef.current) {
      if (d.recipient && d.recipient.id === id) return d.recipient
    }
    for (const f of friendsRef.current?.friends || []) if (f.id === id) return f
    for (const r of friendsRef.current?.incoming || []) if (r.user && r.user.id === id) return r.user
    for (const r of friendsRef.current?.outgoing || []) if (r.user && r.user.id === id) return r.user
    return { id, username: 'Unknown', color: '#4e5058' }
  }, [])
  findUserRef.current = findUser

  const clearCallState = useCallback(() => {
    dmCallRef.current = null
    incomingCallRef.current = null
    setDmCall(null)
    setIncomingCall(null)
    setCallParticipants({})
    setSelfMedia({ audio: false, camera: false, screen: false })
    setSelfMuted(false)
    setSelfDeafened(false)
  }, [])

  const endDmCall = useCallback(() => {
    const call = dmCallRef.current
    stopRing()
    if (call && call.peer) {
      socketRef.current?.emit('call:leave', { to: call.peer.id, roomId: call.roomId })
    }
    engineRef.current?.close()
    clearCallState()
  }, [stopRing, clearCallState])

  const leaveVoice = useCallback((skipSound) => {
    const v = myVoiceRef.current
    socketRef.current?.emit('voice:leave', { channelId: v ? v.channelId : undefined })
    engineRef.current?.close()
    myVoiceRef.current = null
    setMyVoice(null)
    setCallParticipants({})
    setSelfMedia({ audio: false, camera: false, screen: false })
    setSelfMuted(false)
    setSelfDeafened(false)
    setView((cur) => {
      if (!cur || cur.type !== 'voice') return cur
      const s = serversRef.current.find((x) => x.id === cur.serverId)
      const chs = (s && s.channels) || []
      const target = chs.find((c) => c.id !== cur.channelId && c.type !== 'voice') || chs.find((c) => c.id !== cur.channelId) || chs[0]
      return { type: 'server', serverId: cur.serverId, channelId: target ? target.id : cur.channelId }
    })
    if (!skipSound) {
      try { soundLeave() } catch { /* noop */ }
    }
  }, [])

  const joinVoice = useCallback(async (channelId) => {
    const server = serversRef.current.find((s) => s.id === viewRef.current?.serverId)
    if (!server) return
    const members = server.members || []
    const memberUser = (id) => members.find((m) => m.id === id) || { id, username: 'Unknown', color: '#4e5058' }
    if (dmCallRef.current) endDmCall()
    if (myVoiceRef.current) leaveVoice(true)
    const engine = getEngine()
    let audioOk = false
    try { audioOk = await engine.acquireAudio() } catch { audioOk = false }
    socketRef.current?.emit('voice:join', { channelId }, (res) => {
      if (res && res.error) {
        alert(res.error)
        engine.close()
        return
      }
      myVoiceRef.current = { serverId: server.id, channelId }
      setMyVoice({ serverId: server.id, channelId })
      setView({ type: 'voice', serverId: server.id, channelId })
      setMembersVisible(false)
      try { soundJoin() } catch { /* noop */ }
      setSelfMedia((prev) => ({ ...prev, audio: audioOk }))
      setSelfMuted(false)
      setSelfDeafened(false)
      setCallParticipants((prev) => ({
        ...prev,
        [meRef.current?.id]: { ...(prev[meRef.current?.id] || {}), user: meRef.current, self: true, connected: true, stream: engine.getLocalStream(), kind: 'audio' }
      }))
      const memberIds = res.members || []
      for (const id of memberIds) {
        if (id === meRef.current?.id) continue
        setCallParticipants((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), user: memberUser(id), connected: false } }))
      }
      engine.roomId = `vc:${server.id}:${channelId}`
      engine.join(engine.roomId, memberIds)
    })
  }, [getEngine, endDmCall, leaveVoice])

  const startDmCall = useCallback(async (dmId, withVideo) => {
    const dm = dmsRef.current.find((d) => d.id === dmId)
    const peer = dm && dm.recipient
    if (!peer) return
    if (incomingCallRef.current) return
    if (dmCallRef.current) endDmCall()
    if (myVoiceRef.current) leaveVoice(true)
    const engine = getEngine()
    let audioOk = false
    let camOk = false
    try { audioOk = await engine.acquireAudio() } catch { audioOk = false }
    if (withVideo && audioOk) {
      try { camOk = await engine.acquireCamera() } catch { camOk = false }
    }
    const roomId = `dm:${dm.id}:${meRef.current?.id}:${Date.now().toString(36)}`
    engine.roomId = roomId
    const call = { roomId, dmId, peer, stage: 'ringing', withVideo }
    dmCallRef.current = call
    setDmCall(call)
    setSelfMedia({ audio: audioOk, camera: camOk, screen: false })
    setSelfMuted(false)
    setSelfDeafened(false)
    setCallParticipants({ [meRef.current?.id]: { user: meRef.current, self: true, connected: true, stream: engine.getLocalStream(), kind: camOk ? 'camera' : 'audio' } })
    try { soundRing() } catch { /* noop */ }
    startRing()
    socketRef.current?.emit('call:invite', { to: peer.id, call: { roomId, kind: 'dm', dmId } }, (res) => {
      if (res && res.error) {
        alert(res.error)
        endDmCall()
      }
    })
  }, [getEngine, endDmCall, leaveVoice, startRing])

  const acceptIncoming = useCallback(async () => {
    const inc = incomingCallRef.current
    if (!inc) return
    setIncomingCall(null)
    incomingCallRef.current = null
    stopRing()
    if (myVoiceRef.current) leaveVoice(true)
    if (dmCallRef.current) endDmCall()
    const engine = getEngine()
    let audioOk = false
    try { audioOk = await engine.acquireAudio() } catch { audioOk = false }
    engine.roomId = inc.roomId
    const call = { roomId: inc.roomId, dmId: inc.dmId, peer: inc.user, stage: 'connecting' }
    dmCallRef.current = call
    setDmCall(call)
    setSelfMedia({ audio: audioOk, camera: false, screen: false })
    setSelfMuted(false)
    setSelfDeafened(false)
    setCallParticipants({
      [meRef.current?.id]: { user: meRef.current, self: true, connected: true, stream: engine.getLocalStream(), kind: 'audio' },
      [inc.from]: { user: inc.user, connected: false }
    })
    try { soundCallConnected() } catch { /* noop */ }
    socketRef.current?.emit('call:accept', { to: inc.from, roomId: inc.roomId })
  }, [getEngine, endDmCall, leaveVoice, stopRing])

  const declineIncoming = useCallback(() => {
    const inc = incomingCallRef.current
    if (!inc) return
    setIncomingCall(null)
    incomingCallRef.current = null
    stopRing()
    socketRef.current?.emit('call:decline', { to: inc.from, roomId: inc.roomId })
    try { soundCallDecline() } catch { /* noop */ }
  }, [stopRing])

  const toggleMute = useCallback(() => {
    setSelfMuted((prev) => {
      const next = !prev
      engineRef.current?.setMuted(next)
      return next
    })
  }, [])

  const toggleDeafen = useCallback(() => {
    setSelfDeafened((prev) => {
      const next = !prev
      engineRef.current?.setDeafened(next)
      return next
    })
  }, [])

  const toggleCamera = useCallback(async () => {
    const engine = engineRef.current
    if (!engine) return
    if (selfMedia.camera) {
      engine.disableVideo()
      setSelfMedia((prev) => ({ ...prev, camera: false, screen: false }))
      setCallParticipants((prev) => {
        const cur = prev[meRef.current?.id]
        if (!cur) return prev
        return { ...prev, [meRef.current?.id]: { ...cur, kind: cur.kind === 'screen' ? 'screen' : 'audio' } }
      })
    } else {
      const ok = await engine.enableCamera()
      if (ok) {
        setSelfMedia((prev) => ({ ...prev, camera: true, screen: false }))
        setCallParticipants((prev) => ({ ...prev, [meRef.current?.id]: { ...(prev[meRef.current?.id] || {}), kind: 'camera' } }))
      }
    }
  }, [selfMedia.camera])

  const toggleScreen = useCallback(async () => {
    const engine = engineRef.current
    if (!engine) return
    if (selfMedia.screen) {
      engine.disableVideo()
      setSelfMedia((prev) => ({ ...prev, camera: false, screen: false }))
      setCallParticipants((prev) => ({ ...prev, [meRef.current?.id]: { ...(prev[meRef.current?.id] || {}), kind: 'audio' } }))
    } else {
      const ok = await engine.enableScreen()
      if (ok) {
        setSelfMedia((prev) => ({ ...prev, camera: false, screen: true }))
        setCallParticipants((prev) => ({ ...prev, [meRef.current?.id]: { ...(prev[meRef.current?.id] || {}), kind: 'screen' } }))
      }
    }
  }, [selfMedia.screen])

  const createServer = async (data) => {
    setModal(null)
    await refreshServers()
    selectServer(data.id)
  }

  const createChannel = async (channel) => {
    setModal(null)
    setChannelModalCat(null)
    await refreshServers()
    if (channel.type === 'voice') return
    setView((v) => (v ? { ...v, channelId: channel.id } : v))
  }

  const reorderChannels = async (orderedIds, moves = []) => {
    if (!currentServer) return
    await api(`/servers/${currentServer.id}/channels/reorder`, { method: 'POST', body: { orderedIds } })
    for (const m of moves) {
      await api(`/servers/${currentServer.id}/channels/${m.id}`, { method: 'PATCH', body: { categoryId: m.categoryId } })
    }
    await refreshServers()
  }

  const reorderCategories = async (orderedIds) => {
    if (!currentServer) return
    await api(`/servers/${currentServer.id}/categories/reorder`, { method: 'POST', body: { orderedIds } })
    await refreshServers()
  }

  const channelAction = async (channelId, action) => {
    if (!currentServer) return
    const ch = currentServer.channels.find((c) => c.id === channelId)
    if (!ch) return
    const url = `/servers/${currentServer.id}/channels/${channelId}`
    try {
      if (action === 'rename') {
        const name = window.prompt('Channel name (2-32 characters):', ch.name)
        if (!name) return
        await api(url, { method: 'PATCH', body: { name: name.trim() } })
      } else if (action === 'topic') {
        const topic = window.prompt(`Topic for #${ch.name} (200 chars max):`, ch.topic || '')
        if (topic === null) return
        await api(url, { method: 'PATCH', body: { topic } })
      } else if (action === 'delete') {
        if (!window.confirm(`Delete #${ch.name}? Its messages will be gone forever.`)) return
        await api(url, { method: 'DELETE' })
        if (view && view.type !== 'thread' && view.channelId === channelId) {
          const s = servers.find((x) => x.id === currentServer.id)
          const firstText = s && s.channels.find((c) => c.id !== channelId && c.type !== 'voice')
          if (s && firstText) setView({ type: 'server', serverId: s.id, channelId: firstText.id })
        }
      }
      await refreshServers()
    } catch (err) {
      if (err.auth) return
      alert(err.message)
    }
  }

  const openDmFromModal = async (dm) => {
    setModal(null)
    await refreshDms()
    setView({ type: 'dm', dmId: dm.id })
    setMembersVisible(false)
  }

  const openDm = async (user) => {
    try {
      const dm = await api('/dms', { method: 'POST', body: { userId: user.id } })
      await refreshDms()
      setView({ type: 'dm', dmId: dm.id })
      setMembersVisible(false)
    } catch (err) {
      if (err.auth) return
      alert(err.message)
    }
  }

  const addFriend = async (user) => {
    try {
      await api('/friends/request', { method: 'POST', body: { userId: user.id } })
      await refreshFriends()
    } catch (err) {
      if (err.auth) return
      alert(err.message)
    }
  }

  const leaveServer = async () => {
    if (!currentServer) return
    if (currentServer.isOwner) {
      alert('Server owners cannot leave their own server.')
      return
    }
    try {
      await api(`/servers/${currentServer.id}/leave`, { method: 'POST' })
      await refreshServers()
      setView(null)
    } catch (err) {
      if (err.auth) return
      alert(err.message)
    }
  }

  const updateStatus = async (status) => {
    try {
      const { user } = await api('/me', { method: 'PATCH', body: { status } })
      setMe(user)
      setPresences((prev) => ({ ...prev, [user.id]: { online: true, status: user.status } }))
    } catch { /* noop */ }
  }

  const updateProfile = async (user) => {
    setMe(user)
    setPresences((prev) => ({
      ...prev,
      [user.id]: {
        ...(prev[user.id] || {}),
        username: user.username,
        color: user.color,
        customStatus: user.customStatus,
        avatarMedia: user.avatarMedia || null
      }
    }))
  }

  const joinServerByInvite = async (serverId) => {
    setModal(null)
    await refreshServers()
    const s = serversRef.current.find((x) => x.id === serverId)
    if (s && s.channels.length) {
      const firstText = s.channels.find((c) => c.type !== 'voice') || s.channels[0]
      setView({ type: 'server', serverId: s.id, channelId: firstText.id })
    }
  }

  const friendStates = useFriendStates(friends)

  const openInboxItem = async (n) => {
    setInboxOpen(false)
    markInboxSeen()
    const t = n.target
    if (t.type === 'dm') {
      setView({ type: 'dm', dmId: t.id })
      setMembersVisible(false)
    } else {
      const s = servers.find((x) => x.id === t.serverId)
      if (!s) return
      const thread = (s.threads || []).find((x) => x.id === t.id)
      if (thread) {
        selectThread(t.id, s.id)
      } else {
        setView({ type: 'server', serverId: s.id, channelId: t.id })
        setMembersVisible(true)
      }
    }
    setTimeout(() => setScrollTarget(n.id), 450)
  }

  const openQuickItem = (it) => {
    setQuickOpen(false)
    if (it.kind === 'server' || it.kind === 'channel') {
      setView({ type: 'server', serverId: it.serverId, channelId: it.channelId })
      setMembersVisible(true)
    } else if (it.kind === 'thread') {
      selectThread(it.threadId, it.serverId)
    } else if (it.kind === 'dm') {
      setView({ type: 'dm', dmId: it.dmId })
      setMembersVisible(false)
    }
  }

  if (booting) return <Splash />
  if (!me) return <AuthScreen onAuth={handleAuth} />

  const members = currentServer ? currentServer.members.map(withPresence) : []

  const renderMain = () => {
    if (!view) {
      return (
        <FriendsView
          me={me}
          data={friends}
          onRefresh={refreshFriends}
          onOpenDm={openDm}
        />
      )
    }

    if (view.type === 'server' || view.type === 'thread') {
      const isThread = view.type === 'thread'
      if (!isThread && !currentChannel) return null
      if (isThread && !currentThread) return null
      return (
        <>
          <ChatView
            title={isThread ? (currentThread?.name || 'Thread') : currentChannel.name}
            topic={isThread ? `Thread in #${currentChannel ? currentChannel.name : ''}` : currentChannel.topic}
            headerIcon={isThread ? <ThreadIcon size={18} /> : '#'}
            messages={currentMessages}
            typingUsers={currentTyping}
            me={me}
            members={members}
            roles={currentServer.roles || {}}
            friendStates={friendStates}
            membersVisible={membersVisible}
            onToggleMembers={() => setMembersVisible((v) => !v)}
            onSend={sendMessage}
            onTyping={emitTyping}
            onReact={handleReact}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPin={handlePin}
            onOpenProfile={() => {}}
            onAddFriend={addFriend}
            onOpenDm={openDm}
            onCreateThread={isThread ? undefined : createThread}
            onOpenThread={selectThread}
            onSearch={handleSearch}
            onTogglePins={() => setPinsOpen((v) => !v)}
            pinCount={currentPins.length}
            scrollTarget={scrollTarget}
            onScrollTargetDone={() => setScrollTarget(null)}
            hasMore={currentTarget ? hasMoreMap[keyFor(currentTarget)] : false}
            onLoadEarlier={() => currentTarget && loadEarlier(currentTarget)}
            customEmoji={currentServer.emojis || []}
            onCall={() => dmCallRef.current ? undefined : currentDm && startDmCall(currentDm.id, false)}
            onVideoCall={() => dmCallRef.current ? undefined : currentDm && startDmCall(currentDm.id, true)}
          />
          {searchResults && <SearchOverlay results={searchResults} onJump={jumpTo} onClose={() => setSearchResults(null)} />}
          {pinsOpen && (
            <PinsDrawer
              messages={currentPins}
              onClose={() => setPinsOpen(false)}
              onJump={(id) => { setScrollTarget(id); setPinsOpen(false) }}
              onRemovePin={(id) => handlePin(id)}
            />
          )}
          {membersVisible && (
            <MemberList
              members={members}
              roles={currentServer.roles || {}}
              friendStates={friendStates}
              me={me}
              onDm={openDm}
              onAddFriend={addFriend}
            />
          )}
        </>
      )
    }

    if (view.type === 'dm') {
      const dm = currentDm
      const dmMembers = dm ? [me, withPresence(dm.recipient)] : []
      return (
        <>
          <ChatView
            title={dm ? withPresence(dm.recipient).username : 'Direct Message'}
            topic={dm ? (withPresence(dm.recipient).online ? 'Online' : 'Offline') : ''}
            headerIcon="@"
            messages={currentMessages}
            typingUsers={currentTyping}
            me={me}
            members={dmMembers}
            roles={{}}
            friendStates={friendStates}
            membersVisible={false}
            onToggleMembers={() => {}}
            onSend={sendMessage}
            onTyping={emitTyping}
            onReact={handleReact}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPin={handlePin}
            onOpenProfile={() => {}}
            onAddFriend={addFriend}
            onOpenDm={openDm}
            onSearch={handleSearch}
            onTogglePins={() => setPinsOpen((v) => !v)}
            pinCount={0}
            scrollTarget={scrollTarget}
            onScrollTargetDone={() => setScrollTarget(null)}
            hasMore={currentTarget ? hasMoreMap[keyFor(currentTarget)] : false}
            onLoadEarlier={() => currentTarget && loadEarlier(currentTarget)}
            customEmoji={[]}
            onCall={() => dmCallRef.current ? undefined : currentDm && startDmCall(currentDm.id, false)}
            onVideoCall={() => dmCallRef.current ? undefined : currentDm && startDmCall(currentDm.id, true)}
          />
          {searchResults && <SearchOverlay results={searchResults} onJump={jumpTo} onClose={() => setSearchResults(null)} />}
        </>
      )
    }

    if (view.type === 'voice') {
      const vserver = currentServer
      const ch = vserver && vserver.channels && vserver.channels.find((c) => c.id === view.channelId)
      const voiceMembers = vserver ? ((voiceChannels[vserver.id] || {})[view.channelId] || []) : []
      const participants = [
        ...(callParticipants[me?.id] ? [callParticipants[me?.id]] : []),
        ...voiceMembers
          .filter((id) => id !== me?.id && callParticipants[id])
          .map((id) => callParticipants[id])
      ]
      return (
        <>
          <VoiceChannelView
            channelName={ch ? ch.name : 'Voice'}
            serverName={vserver ? vserver.name : 'Voice'}
            self={me}
            participants={participants}
            muted={selfMuted}
            deafened={selfDeafened}
            screenActive={selfMedia.screen}
            onToggleMute={toggleMute}
            onToggleDeafen={toggleDeafen}
            onStartScreen={toggleScreen}
            onDisconnect={leaveVoice}
          />
          {searchResults && <SearchOverlay results={searchResults} onJump={jumpTo} onClose={() => setSearchResults(null)} />}
        </>
      )
    }
    return null
  }

  const myVoiceForServer = myVoice && (
    (currentServer && myVoice.serverId === currentServer.id) ||
    (view && view.type === 'voice' && myVoice.serverId === view.serverId)
  ) ? myVoice : null
  const voiceServerId = currentServer ? currentServer.id : (view && view.type === 'voice' ? view.serverId : null)
  const voiceChannelsForServer = voiceServerId ? (voiceChannels[voiceServerId] || {}) : {}
  const inboxUnread = inbox.filter((n) => !inboxSeen.has(n.id)).length

  return (
    <div className="app">
      <ServerRail
        servers={servers}
        current={view && view.type === 'server' ? { serverId: view.serverId } : null}
        onSelect={selectServer}
        onHome={() => { setView(null); setMembersVisible(false) }}
        onAddServer={() => setModal('create-server')}
        onInbox={() => { setInboxOpen((v) => !v); if (!inboxOpen) markInboxSeen() }}
        inboxUnread={inboxUnread}
        inboxOpen={inboxOpen}
      />
      {inboxOpen && (
        <InboxPanel
          notifications={inbox}
          seen={inboxSeen}
          onJump={openInboxItem}
          onClose={() => setInboxOpen(false)}
        />
      )}
      <Sidebar
        view={view}
        server={currentServer || (myVoice ? servers.find((s) => s.id === myVoice.serverId) : null)}
        dms={dms}
        user={me}
        unread={unread}
        onSelectChannel={selectChannel}
        onSelectDm={selectDm}
        onSelectThread={selectThread}
        onThreadAction={threadAction}
        onCreateChannel={(catId) => { setChannelModalCat(catId || null); setModal('create-channel') }}
        onCreateDm={() => setModal('dm')}
        onLeaveServer={leaveServer}
        onUpdateStatus={updateStatus}
        onLogout={handleLogout}
        onSettings={() => setSettingsOpen(true)}
        onEditProfile={() => { setSettingsTab('account'); setSettingsOpen(true) }}
        onInvite={() => setModal('invite')}
        onServerSettings={() => setServerSettingsOpen(true)}
        onHome={() => { setView(null); setMembersVisible(false) }}
        voiceChannels={voiceChannelsForServer}
        myVoice={myVoiceForServer}
        speaking={speakingMap}
        onJoinVoice={joinVoice}
        onLeaveVoice={leaveVoice}
        canManage={!!currentServer && (currentServer.isOwner || currentServer.isAdmin)}
        onReorderChannels={reorderChannels}
        onReorderCategories={reorderCategories}
        onChannelAction={channelAction}
      />
      {renderMain()}

      {modal === 'create-server' && (
        <CreateServerModal onClose={() => setModal(null)} onCreated={createServer} />
      )}
      {modal === 'create-channel' && currentServer && (
        <CreateChannelModal
          serverId={currentServer.id}
          categories={currentServer.categories || []}
          initialCategoryId={channelModalCat || ''}
          onClose={() => setModal(null)}
          onCreated={createChannel}
        />
      )}
      {modal === 'dm' && <DmModal onClose={() => setModal(null)} onOpened={openDmFromModal} />}
      {modal === 'invite' && currentServer && (
        <InviteModal serverId={currentServer.id} serverName={currentServer.name} onClose={() => setModal(null)} />
      )}
      {modal === 'join' && <JoinServerModal onClose={() => setModal(null)} onJoined={joinServerByInvite} />}

      {settingsOpen && (
        <SettingsModal
          me={me}
          initialTab={settingsTab}
          onClose={() => setSettingsOpen(false)}
          onLogout={handleLogout}
          onUpdateProfile={updateProfile}
        />
      )}

      {serverSettingsOpen && currentServer && (
        <ServerSettingsModal
          server={currentServer}
          onClose={() => setServerSettingsOpen(false)}
          onUpdated={refreshServers}
        />
      )}

      {dmCall && (
        <DmCallView
          stage={dmCall.stage}
          title={dmCall.peer ? withPresence(dmCall.peer).username : 'Call'}
          peer={dmCall.peer}
          self={me}
          participants={[
            ...(callParticipants[me?.id] ? [callParticipants[me?.id]] : []),
            ...Object.values(callParticipants).filter((p) => !p.self)
          ]}
          muted={selfMuted}
          deafened={selfDeafened}
          cameraOn={selfMedia.camera}
          screenActive={selfMedia.screen}
          onToggleMute={toggleMute}
          onToggleDeafen={toggleDeafen}
          onToggleCamera={toggleCamera}
          onStartScreen={toggleScreen}
          onEndCall={endDmCall}
        />
      )}

      {incomingCall && (
        <IncomingCallOverlay
          user={incomingCall.user}
          onAccept={acceptIncoming}
          onDecline={declineIncoming}
        />
      )}

      {myVoice && (
        <VoiceBanner
          channelName={(() => {
            const s = serversRef.current.find((x) => x.id === myVoice.serverId)
            return s && s.channels && s.channels.find((c) => c.id === myVoice.channelId)?.name || 'Voice'
          })()}
          muted={selfMuted}
          deafened={selfDeafened}
          onToggleMute={toggleMute}
          onToggleDeafen={toggleDeafen}
          onDisconnect={leaveVoice}
        />
      )}

      {quickOpen && (
        <QuickSwitcher
          servers={servers}
          dms={dms}
          onOpen={openQuickItem}
          onClose={() => setQuickOpen(false)}
        />
      )}
    </div>
  )
}

function useFriendStates(friends) {
  return useMemo(() => {
    const map = {}
    for (const f of friends.friends || []) map[f.id] = 'friends'
    for (const r of friends.incoming || []) map[r.user.id] = 'incoming'
    for (const r of friends.outgoing || []) map[r.user.id] = 'outgoing'
    return map
  }, [friends])
}

function SearchOverlay({ results, onJump, onClose }) {
  return (
    <div className="search-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="search-panel">
        <div className="search-panel-header">
          <span><SearchIcon size={16} /> Results for “{results.query}”</span>
          <button className="search-close" onClick={onClose}><CloseIcon size={16} /></button>
        </div>
        <div className="search-panel-list">
          {results.messages.length === 0 && <div className="search-empty">No messages found</div>}
          {results.messages.map((m) => (
            <button key={m.id} className="search-result" onClick={() => onJump(m.id)}>
              <Avatar user={m.author} size={32} />
              <div className="search-result-body">
                <div className="search-result-head">
                  <span style={{ color: m.author.color }}>{m.author.username}</span>
                  <span className="search-result-time">{formatShortTime(m.createdAt)}</span>
                </div>
                <div className="search-result-content">{m.content}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatShortTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

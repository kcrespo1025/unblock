const DEFAULT_ICE = [{ urls: 'stun:stun.l.google.com:19302' }]

function hasMediaDevices() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia
}

export function rtcSupported() {
  return hasMediaDevices() && typeof window !== 'undefined' && typeof window.RTCPeerConnection === 'function'
}

export function isSecureContext() {
  return typeof window !== 'undefined' && (window.isSecureContext === true || /^https:|^file:/.test(window.location.protocol))
}

class VoiceActivity {
  constructor(stream, { onSpeaking, muted = false } = {}) {
    this.onSpeaking = onSpeaking
    this.muted = muted
    this.speaking = false
    this.quietTimer = null
    this.raf = 0
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    try {
      this.ctx = new AC()
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 512
      this.analyser.smoothingTimeConstant = 0.4
      this.src = this.ctx.createMediaStreamSource(stream)
      this.src.connect(this.analyser)
      this.buf = new Uint8Array(this.analyser.fftSize)
      if (this.ctx.state === 'suspended') this.ctx.resume()
      this.tick = this.tick.bind(this)
      this.raf = requestAnimationFrame(this.tick)
    } catch {
      this.src = null
    }
  }

  setMuted(m) {
    this.muted = m
  }

  tick() {
    if (!this.analyser) return
    const now = performance.now()
    if (this.muted) {
      this.setSpeaking(false)
      this.raf = requestAnimationFrame(this.tick)
      return
    }
    this.analyser.getByteTimeDomainData(this.buf)
    let sum = 0
    for (let i = 0; i < this.buf.length; i++) {
      const v = (this.buf[i] - 128) / 128
      sum += v * v
    }
    const rms = Math.sqrt(sum / this.buf.length)
    const threshold = this.speaking ? 0.012 : 0.028
    if (rms >= threshold) {
      if (this.quietTimer) {
        clearTimeout(this.quietTimer)
        this.quietTimer = null
      }
      this.setSpeaking(true)
    } else if (this.speaking && !this.quietTimer) {
      this.quietTimer = setTimeout(() => {
        this.quietTimer = null
        this.setSpeaking(false)
      }, 160)
    }
    this.raf = requestAnimationFrame(this.tick)
  }

  setSpeaking(s) {
    if (this.speaking !== s) {
      this.speaking = s
      if (this.onSpeaking) this.onSpeaking(s)
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    if (this.quietTimer) clearTimeout(this.quietTimer)
    try {
      this.src && this.src.disconnect()
      this.analyser && this.analyser.disconnect()
      this.ctx && this.ctx.close()
    } catch { /* noop */ }
  }
}

export class CallEngine {
  constructor({ signal, onSpeaking, onStream, onState } = {}) {
    this.signal = signal
    this.onSpeaking = onSpeaking
    this.onStream = onStream
    this.onState = onState
    this.roomId = null
    this.peers = new Map()
    this.remoteVads = new Map()
    this.localStream = null
    this.vad = null
    this.media = { audio: false, camera: false, screen: false }
    this.muted = false
    this.deafened = false
    this.makingOffer = false
    this.offerQueue = []
    this.iceServers = DEFAULT_ICE
    this.closed = false
  }

  async acquireAudio() {
    if (!rtcSupported() || !isSecureContext()) return false
    try {
      if (!this.localStream) {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      }
      this.media.audio = true
      return true
    } catch {
      return false
    }
  }

  async acquireCamera() {
    if (!rtcSupported() || !isSecureContext()) return false
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 } } })
      this.replaceVideoTrack(s, 'camera')
      return true
    } catch {
      return false
    }
  }

  async acquireScreen() {
    if (!rtcSupported() || !isSecureContext()) return false
    try {
      if (!navigator.mediaDevices.getDisplayMedia) return false
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      this.replaceVideoTrack(s, 'screen')
      return true
    } catch {
      return false
    }
  }

  replaceVideoTrack(stream, kind) {
    const videoTrack = stream.getVideoTracks()[0]
    const local = this.localStream || (this.localStream = new MediaStream())
    const existing = local.getVideoTracks()
    for (const t of existing) {
      t.stop()
      local.removeTrack(t)
    }
    for (const t of stream.getTracks()) {
      if (t !== videoTrack) t.stop()
    }
    local.addTrack(videoTrack)
    this.media.camera = kind === 'camera'
    this.media.screen = kind === 'screen'
    if (!this.media.audio) this.media.audio = local.getAudioTracks().length > 0
    this.renegotiate()
    return videoTrack
  }

  async enableCamera() {
    const ok = await this.acquireCamera()
    return ok
  }

  async enableScreen() {
    const ok = await this.acquireScreen()
    return ok
  }

  disableVideo() {
    if (!this.localStream) return
    const tracks = this.localStream.getVideoTracks()
    for (const t of tracks) {
      t.stop()
      this.localStream.removeTrack(t)
    }
    this.media.camera = false
    this.media.screen = false
    this.renegotiate()
  }

  setMuted(m) {
    this.muted = !!m
    if (this.localStream) {
      for (const t of this.localStream.getAudioTracks()) t.enabled = !this.muted
    }
    if (this.vad) this.vad.setMuted(this.muted || this.deafened)
  }

  setDeafened(d) {
    this.deafened = !!d
    if (this.deafened) {
      if (this.localStream) {
        for (const t of this.localStream.getAudioTracks()) t.enabled = false
      }
    } else if (!this.muted && this.localStream) {
      for (const t of this.localStream.getAudioTracks()) t.enabled = true
    }
    if (this.vad) this.vad.setMuted(this.muted || this.deafened)
    this.notifyMediaAll()
  }

  getLocalStream() {
    return this.localStream
  }

  join(roomId, existingMembers) {
    if (this.closed) return
    this.roomId = roomId
    if (this.localStream && this.localStream.getAudioTracks().length) {
      this.vad = new VoiceActivity(this.localStream, {
        onSpeaking: (s) => this.onSpeaking && this.onSpeaking(this.selfId, s)
      })
    }
    for (const memberId of existingMembers || []) {
      if (memberId === this.selfId || this.peers.has(memberId)) continue
      this.createPeer(memberId, true)
    }
  }

  get selfId() {
    return this._selfId
  }

  set selfId(id) {
    this._selfId = id
  }

  addExistingParticipant(memberId, initiator = true) {
    if (this.closed || !memberId || memberId === this.selfId || this.peers.has(memberId)) return
    this.createPeer(memberId, initiator)
  }

  createPeer(remoteId, initiator) {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers })
    const peer = { remoteId, pc, initiator, offered: false, negotiated: false, connected: false, stream: null, kind: 'audio', speakState: false }
    this.peers.set(remoteId, peer)

    pc.onicecandidate = (e) => {
      if (!e.candidate || this.closed) return
      this.sendTo(remoteId, { type: 'candidate', candidate: e.candidate })
    }
    pc.ontrack = (e) => {
      const stream = e.streams && e.streams[0]
      if (!stream) return
      if (!peer.stream || peer.stream !== stream) {
        peer.stream = stream
        const kind = stream.getVideoTracks().length ? (this.detectVideoKind(stream) || 'camera') : 'audio'
        peer.kind = kind
        this.attachRemoteVad(remoteId, stream)
        this.onStream && this.onStream(remoteId, stream, kind)
      } else if (stream.getVideoTracks().length && peer.kind === 'audio') {
        peer.kind = this.detectVideoKind(stream) || 'camera'
        this.onStream && this.onStream(remoteId, stream, peer.kind)
      }
    }
    pc.onnegotiationneeded = () => {
      if (!peer.negotiated) return
      if (peer.initiator) this.makeOffer(remoteId)
      else this.sendTo(remoteId, { type: 'renegotiate' })
    }
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      if (state === 'connected') {
        peer.connected = true
      } else if (state === 'failed' || state === 'closed' || state === 'disconnected') {
        if (peer.connected) {
          peer.connected = false
        }
      }
      this.onState && this.onState(remoteId, state)
    }
    pc.oniceconnectionstatechange = () => {
      this.onState && this.onState(remoteId, `ice:${pc.iceConnectionState}`)
    }

    if (this.localStream) {
      for (const t of this.localStream.getTracks()) {
        if (!t.enabled) t.enabled = this.localStream.getAudioTracks().includes(t) ? !this.muted && !this.deafened : true
        try { pc.addTrack(t, this.localStream) } catch { /* noop */ }
      }
    }
    if (initiator) this.makeOffer(remoteId)
    return peer
  }

  detectVideoKind(stream) {
    const track = stream.getVideoTracks()[0]
    if (!track) return 'audio'
    if (track.getSettings && track.getSettings()) {
      const s = track.getSettings()
      if (s.displaySurface) return 'screen'
    }
    return 'camera'
  }

  attachRemoteVad(remoteId, stream) {
    if (!stream.getAudioTracks().length) return
    const vad = new VoiceActivity(stream, {
      onSpeaking: (s) => {
        const peer = this.peers.get(remoteId)
        if (peer) peer.speakState = s
        this.onSpeaking && this.onSpeaking(remoteId, s)
      }
    })
    this.remoteVads.set(remoteId, vad)
  }

  renegotiate() {
    for (const peer of this.peers.values()) {
      if (!peer.negotiated) continue
      if (peer.initiator) this.makeOffer(peer.remoteId)
      else this.sendTo(peer.remoteId, { type: 'renegotiate' })
    }
  }

  async makeOffer(remoteId) {
    const peer = this.peers.get(remoteId)
    if (!peer || this.closed) return
    if (this.makingOffer) {
      if (!this.offerQueue.includes(remoteId)) this.offerQueue.push(remoteId)
      return
    }
    this.makingOffer = true
    try {
      const offer = await peer.pc.createOffer()
      await peer.pc.setLocalDescription(offer)
      peer.offered = true
      this.sendTo(remoteId, { type: 'offer', sdp: peer.pc.localDescription })
    } catch { /* noop */ }
    this.makingOffer = false
    const next = this.offerQueue.shift()
    if (next) this.makeOffer(next)
  }

  async onSignal(remoteId, data) {
    if (this.closed) return
    const type = data && data.type
    if (type === 'speaking') {
      const peer = this.peers.get(remoteId)
      if (peer) peer.speakState = !!data.speaking
      this.onSpeaking && this.onSpeaking(remoteId, !!data.speaking)
      return
    }
    if (type === 'candidate') {
      const peer = this.peers.get(remoteId)
      if (!peer) return
      try { await peer.pc.addIceCandidate(data.candidate) } catch { /* noop */ }
      return
    }
    if (type === 'renegotiate') {
      const peer = this.peers.get(remoteId)
      if (peer && peer.initiator) this.makeOffer(remoteId)
      return
    }
    if (type === 'offer') {
      let peer = this.peers.get(remoteId)
      if (!peer) {
        peer = this.createPeer(remoteId, false)
      }
      const glare = peer.offered && !peer.negotiated
      if (glare) {
        try { peer.pc.setLocalDescription({ type: 'rollback' }) } catch { /* noop */ }
        peer.offered = false
      }
      try {
        await peer.pc.setRemoteDescription(data.sdp)
      } catch { return }
      peer.negotiated = true
      if (glare) {
        this.makeOffer(remoteId)
        return
      }
      try {
        const answer = await peer.pc.createAnswer()
        await peer.pc.setLocalDescription(answer)
        this.sendTo(remoteId, { type: 'answer', sdp: peer.pc.localDescription })
      } catch { /* noop */ }
      return
    }
    if (type === 'answer') {
      const peer = this.peers.get(remoteId)
      if (!peer) return
      try {
        await peer.pc.setRemoteDescription(data.sdp)
        peer.negotiated = true
      } catch { /* noop */ }
    }
  }

  sendTo(remoteId, data) {
    if (this.signal) {
      try { this.signal(remoteId, data) } catch { /* noop */ }
    }
  }

  broadcastSpeaking(s) {
    for (const id of this.peers.keys()) this.sendTo(id, { type: 'speaking', speaking: !!s })
  }

  notifyMediaAll() {
    for (const peer of this.peers.values()) {
      this.onState && this.onState(peer.remoteId, peer.connected ? 'connected' : 'connecting')
    }
  }

  peerIds() {
    return [...this.peers.keys()]
  }

  disconnectPeer(remoteId) {
    const peer = this.peers.get(remoteId)
    if (peer) {
      try { peer.pc.close() } catch { /* noop */ }
      this.peers.delete(remoteId)
    }
    const vad = this.remoteVads.get(remoteId)
    if (vad) {
      vad.dispose()
      this.remoteVads.delete(remoteId)
    }
  }

  close() {
    this.closed = true
    if (this.vad) {
      this.vad.dispose()
      this.vad = null
    }
    for (const vad of this.remoteVads.values()) vad.dispose()
    this.remoteVads.clear()
    for (const peer of this.peers.values()) {
      try { peer.pc.close() } catch { /* noop */ }
    }
    this.peers.clear()
    if (this.localStream) {
      for (const t of this.localStream.getTracks()) {
        t.stop()
        this.localStream.removeTrack(t)
      }
      this.localStream = null
    }
    this.roomId = null
    this.media = { audio: false, camera: false, screen: false }
  }
}

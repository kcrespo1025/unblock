// Client-side simulation of the Underground backend so the whole app runs
// from a single HTML file (file://) with no server. Data persists in
// localStorage; events are shared between tabs via BroadcastChannel +
// localStorage storage-events so chat feels live across browser tabs.

const TOKEN_KEY = 'underground_token'
const STORE_KEY = 'underground_standalone_v1'
const BUS_KEY = 'underground_bus_v1'

let store = null
let bc = null
const activeSockets = []
const voiceRooms = new Map()
let busReady = false

function uid(prefix) {
  return prefix + Math.random().toString(16).slice(2, 14)
}

function now() {
  return new Date().toISOString()
}

function safeGet(k) {
  try { return localStorage.getItem(k) } catch { return null }
}
function safeSet(k, v) {
  try { localStorage.setItem(k, v) } catch { /* quota / disabled */ }
}
function safeRemove(k) {
  try { localStorage.removeItem(k) } catch { /* noop */ }
}

// Random bytes with a Math.random fallback for non-secure contexts.
function cryptoRandom(n) {
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const out = new Uint8Array(n)
      crypto.getRandomValues(out)
      return out
    }
  } catch { /* noop */ }
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256)
  return out
}

// Synchronous SHA-256 so passwords are never stored in plaintext in
// localStorage, even on file:// where WebCrypto may be unavailable.
const SHA256_K = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
]
function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str)
  const l = bytes.length
  const bits = l * 8
  const n = (((l + 8) >> 6) + 1) << 4
  const buf = new Uint8Array(n * 4)
  buf.set(bytes)
  buf[l] = 0x80
  new DataView(buf.buffer).setUint32(n * 4 - 4, bits, false)
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19
  const w = new Uint32Array(64)
  const view = new DataView(buf.buffer)
  for (let i = 0; i < n; i += 16) {
    for (let j = 0; j < 16; j++) w[j] = view.getUint32((i + j) * 4, false)
    for (let j = 16; j < 64; j++) {
      const x = w[j - 15]
      const y = w[j - 2]
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7
    for (let j = 0; j < 64; j++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + SHA256_K[j] + w[j]) | 0
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) | 0
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0
  }
  const out = new DataView(new ArrayBuffer(32))
  ;[h0, h1, h2, h3, h4, h5, h6, h7].forEach((v, i) => out.setUint32(i * 4, v, false))
  return [...new Uint8Array(out.buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function hashPasswordLocal(password, salt) {
  return sha256Hex(salt + ':' + sha256Hex(String(password)))
}

// Reversible obfuscation for personally-identifying fields (username/email)
// so no plaintext personal data sits in the source or localStorage. The key
// ships with the app (it must, for standalone to work), so this is
// obfuscation, not true secrecy — but casual readers can't recover the data.
const ENC_KEY = 'underground-obfuscation-key:v7'
const ENC_KEYSTREAM = sha256Hex(ENC_KEY)
function encText(str) {
  if (str == null) return str
  if (typeof str === 'string' && str.startsWith('enc:')) return str
  const out = []
  for (let i = 0; i < str.length; i++) out.push(str.charCodeAt(i) ^ ENC_KEYSTREAM.charCodeAt(i % ENC_KEYSTREAM.length))
  return 'enc:' + out.map((b) => b.toString(16).padStart(2, '0')).join('')
}
function decText(s) {
  if (typeof s !== 'string' || !s.startsWith('enc:')) return s
  const hex = s.slice(4)
  let out = ''
  for (let i = 0; i + 1 < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ ENC_KEYSTREAM.charCodeAt((i / 2) % ENC_KEYSTREAM.length))
  }
  return out
}

// Personal fields are obfuscated at rest; decode into memory so the rest of
// the app works with plaintext.
function openStore(st) {
  for (const u of Object.values(st.users || {})) {
    if (!u) continue
    u.username = decText(u.username)
    u.email = decText(u.email)
  }
}

// Clone-with-encode so persist never leaks plaintext personal data to disk.
function sealStore(st) {
  const out = { ...st }
  out.users = {}
  for (const [id, u] of Object.entries(st.users || {})) {
    out.users[id] = { ...u, username: encText(u.username), email: encText(u.email) }
  }
  return out
}

// ---------- Pure-JS SHA-1 / HMAC-SHA1 / Base32 / TOTP (RFC 6238) ----------
function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}
function sha1Raw(bytes) {
  const l = bytes.length
  const bitLen = l * 8
  const n = (((l + 8) >> 6) + 1) * 64
  const buf = new Uint8Array(n)
  buf.set(bytes)
  buf[l] = 0x80
  const dv = new DataView(buf.buffer)
  dv.setUint32(n - 8, Math.floor(bitLen / 4294967296), false)
  dv.setUint32(n - 4, bitLen >>> 0, false)
  let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0
  const w = new Uint32Array(80)
  for (let i = 0; i < n; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4, false)
    for (let j = 16; j < 80; j++) {
      const x = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16]
      w[j] = (x << 1) | (x >>> 31)
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4
    for (let j = 0; j < 80; j++) {
      let f, k
      if (j < 20) { f = (b & c) | (~b & d); k = 0x5A827999 }
      else if (j < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1 }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC }
      else { f = b ^ c ^ d; k = 0xCA62C1D6 }
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) >>> 0
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = temp
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0
  }
  const out = new Uint8Array(20)
  const o = new DataView(out.buffer)
  o.setUint32(0, h0, false); o.setUint32(4, h1, false); o.setUint32(8, h2, false)
  o.setUint32(12, h3, false); o.setUint32(16, h4, false)
  return out
}
function hmacSha1(keyBytes, msgBytes) {
  const key = keyBytes.length > 64 ? sha1Raw(keyBytes) : keyBytes
  const kb = new Uint8Array(64)
  kb.set(key)
  const ipad = new Uint8Array(64)
  const opad = new Uint8Array(64)
  for (let i = 0; i < 64; i++) { ipad[i] = kb[i] ^ 0x36; opad[i] = kb[i] ^ 0x5c }
  return sha1Raw(concatBytes(opad, sha1Raw(concatBytes(ipad, msgBytes))))
}
const B32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function base32EncodeLocal(bytes) {
  let bits = 0, value = 0, out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) { out += B32_CHARS[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += B32_CHARS[(value << (5 - bits)) & 31]
  return out
}
function base32DecodeLocal(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0, value = 0
  const out = []
  for (const ch of clean) {
    value = (value << 5) | B32_CHARS.indexOf(ch)
    bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return new Uint8Array(out)
}
function totpAtLocal(secret, timeStep) {
  const key = base32DecodeLocal(secret)
  const counter = Math.floor(timeStep / 30000)
  const msg = new Uint8Array(8)
  const dv = new DataView(msg.buffer)
  dv.setUint32(0, Math.floor(counter / 4294967296), false)
  dv.setUint32(4, counter >>> 0, false)
  const h = hmacSha1(key, msg)
  const off = h[19] & 15
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]
  return String(bin % 1000000).padStart(6, '0')
}
function verifyTotpLocal(user, code) {
  const nowMs = Date.now()
  const input = String(code || '').replace(/\s+/g, '')
  for (let w = -1; w <= 1; w++) {
    const ts = nowMs + w * 30000
    const counter = Math.floor(ts / 30000)
    if (user.twoFactorLast && counter <= user.twoFactorLast) continue
    if (totpAtLocal(user.twoFactorSecret, ts) === input) {
      user.twoFactorLast = counter
      return true
    }
  }
  return false
}
const BACKUP_CHARS_LOCAL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genBackupCodesLocal(count = 10) {
  const out = []
  while (out.length < count) {
    let s = ''
    for (let i = 0; i < 10; i++) s += BACKUP_CHARS_LOCAL[Math.floor(Math.random() * BACKUP_CHARS_LOCAL.length)]
    out.push(s.slice(0, 5) + '-' + s.slice(5))
  }
  return out
}
function backupHashLocal(code) {
  return sha256Hex(String(code).toUpperCase().replace(/[^A-Z0-9]/g, ''))
}
function verifyBackupCodeLocal(user, code) {
  const h = backupHashLocal(code)
  const list = user.backupCodes || []
  const i = list.indexOf(h)
  if (i === -1) return false
  list.splice(i, 1)
  if (!list.length) user.backupCodes = null
  return true
}
function otpauthUriLocal(email, secret) {
  return `otpauth://totp/${encodeURIComponent('Underground')}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent('Underground')}`
}
function maskPhoneLocal(p) {
  if (!p) return null
  const digits = String(p).replace(/\D/g, '')
  const prefix = String(p).startsWith('+') ? '+' : ''
  if (!digits.length) return prefix
  return `${prefix}••• ••• ${digits.slice(-4)}`
}
function genCodeLocal() {
  return String(Math.floor(100000 + Math.random() * 900000))
}
function codeValidLocal(user, kind) {
  const at = kind === 'email' ? user.emailCodeAt : user.phoneCodeAt
  return typeof at === 'number' && Date.now() - at < 10 * 60 * 1000
}
function normalizePhoneLocal(input) {
  const s = String(input || '').trim()
  const plus = s.startsWith('+')
  const digits = s.replace(/\D/g, '')
  if (!digits || digits.length < 7 || digits.length > 15) return null
  return (plus ? '+' : '') + digits
}
function selfUserLocal(user) {
  return {
    ...publicUser(user, true),
    email: user.email,
    emailVerified: !!user.emailVerified,
    phoneMasked: maskPhoneLocal(user.phone),
    phoneVerified: !!user.phoneVerified,
    twoFactorEnabled: !!user.twoFactorEnabled,
    hasPassword: !!user.passwordHash
  }
}

function deleteUserAccountLocal(store, userId) {
  if (!store.users[userId]) return false
  delete store.users[userId]

  for (const [token, id] of Object.entries(store.sessions || {})) {
    if (id === userId) delete store.sessions[token]
  }

  for (const s of Object.values(store.servers || {})) {
    s.memberIds = (s.memberIds || []).filter((id) => id !== userId)
    if (s.admins) s.admins = s.admins.filter((id) => id !== userId)
    if (s.memberRoles) delete s.memberRoles[userId]
  }

  const threads = store.threads || {}
  for (const t of Object.values(threads)) {
    if (t.ownerId === userId) {
      delete store.threads[t.id]
      delete store.messages[t.id]
      continue
    }
    t.memberIds = (t.memberIds || []).filter((id) => id !== userId)
  }

  for (const [key, list] of Object.entries(store.messages || {})) {
    store.messages[key] = (list || []).filter((m) => m.authorId !== userId)
  }
  for (const [key, list] of Object.entries(store.dmMessages || {})) {
    store.dmMessages[key] = (list || []).filter((m) => m.authorId !== userId)
  }

  const fships = store.friendships || []
  store.friendships = fships.filter((f) => f.requester !== userId && f.target !== userId)

  const dms = store.dms || {}
  for (const dm of Object.values(dms)) {
    if ((dm.memberIds || []).includes(userId)) {
      delete store.dms[dm.id]
      delete store.dmMessages[dm.id]
    }
  }

  return true
}

function persist() {
  safeSet(STORE_KEY, JSON.stringify(sealStore(store)))
}

function loadStore() {
  if (store) return store
  const raw = safeGet(STORE_KEY)
  if (raw) {
    try {
      store = JSON.parse(raw)
      openStore(store)
    } catch { store = null }
  }
  if (!store) {
    store = {
      users: {},
      sessions: {},
      servers: {},
      channels: {},
      threads: {},
      messages: {},
      dms: {},
      dmMessages: {},
      friendships: [],
      invites: {},
      onlineCounts: {}
    }
    seed()
    persist()
  } else {
    migrateStore()
  }
  return store
}

function migrateStore() {
  let changed = false
  const purgeIds = Object.values(store.users || {})
    .filter((u) => u && (
      /@demo\.dev$/i.test(u.email || '') ||
      /@test\.dev$/i.test(u.email || '') ||
      /^T2fa/i.test(u.username || '') ||
      u.username === 'UI_Tester'
    ))
    .map((u) => u.id)
  for (const id of purgeIds) {
    if (deleteUserAccountLocal(store, id)) changed = true
  }
  if (!store.threads) { store.threads = {}; changed = true }
  for (const u of Object.values(store.users || {})) {
    if (u && u.password && !u.passwordHash) {
      const salt = uid('salt').slice(0, 32)
      u.passwordHash = hashPasswordLocal(u.password, salt)
      u.salt = salt
      delete u.password
      changed = true
    }
    if (u && u.emailVerified === undefined) { u.emailVerified = true; changed = true }
    if (u && u.phone === undefined) { u.phone = null; changed = true }
    if (u && u.phoneVerified === undefined) { u.phoneVerified = false; changed = true }
    if (u && u.twoFactorEnabled === undefined) { u.twoFactorEnabled = false; changed = true }
    if (u && u.twoFactorSecret === undefined) { u.twoFactorSecret = null; changed = true }
    if (u && u.twoFactorLast === undefined) { u.twoFactorLast = null; changed = true }
    if (u && u.backupCodes === undefined) { u.backupCodes = null; changed = true }
  }
  for (const s of Object.values(store.servers || {})) {
    if (!Array.isArray(s.categories)) {
      s.categories = []
      changed = true
    }
  }
  for (const ch of Object.values(store.channels || {})) {
    if (ch.categoryId === undefined) {
      ch.categoryId = null
      changed = true
    }
  }
  for (const s of Object.values(store.servers || {})) {
    const cats = s.categories || []
    if (cats.length === 0 && s.channelIds && s.channelIds.length) {
      const chans = s.channelIds.map((id) => store.channels[id]).filter(Boolean)
      const names = chans.map((ch) => ch.name)
      const hasVoice = chans.some((ch) => ch.type === 'voice')
      if (names.includes('general') && names.includes('announcements') && hasVoice) {
        const infoCat = uid('cat')
        const funCat = uid('cat')
        const vcCat = uid('cat')
        s.categories = [
          { id: infoCat, name: 'Info' },
          { id: funCat, name: 'Fun & Games' },
          { id: vcCat, name: 'Voice' }
        ]
        for (const ch of chans) {
          if (ch.name === 'announcements' || ch.name === 'general') ch.categoryId = infoCat
          else if (ch.name === 'gaming' || ch.name === 'memes' || ch.name === 'music' || ch.name === 'help' || ch.name === 'off-topic') ch.categoryId = funCat
          else if (ch.type === 'voice') ch.categoryId = vcCat
        }
        changed = true
      }
    }
  }
  if (changed) persist()
}

export function ensureSeeded() {
  loadStore()
}

// ---------- helpers ----------

function isOnline(userId) {
  const c = (store.onlineCounts && store.onlineCounts[userId]) || 0
  return c > 0
}

function publicUser(user, onlineFlag) {
  return {
    id: user.id,
    username: user.username,
    color: user.color,
    status: user.status,
    customStatus: user.customStatus || null,
    avatar: user.avatar || null,
    gradient: user.gradient || null,
    banner: user.banner || null,
    bio: user.bio || null,
    pronoun: user.pronoun || null,
    profileTheme: user.profileTheme || null,
    decoration: user.decoration || null,
    avatarMedia: user.avatarMedia || null,
    title: user.title || null,
    badges: user.badges || null,
    online: onlineFlag === undefined ? isOnline(user.id) : onlineFlag
  }
}

function serializeMessage(msg, channelId) {
  const u = msg.authorId === 'system' ? null : store.users[msg.authorId]
  const author = msg.authorId === 'system'
    ? { id: 'system', username: 'System', color: '#4e5058', system: true }
    : u
      ? publicUser(u)
      : { id: msg.authorId, username: 'Deleted User', color: '#72767d', avatar: null, deleted: true }
  const out = {
    id: msg.id,
    author,
    content: msg.content,
    reactions: msg.reactions || {},
    createdAt: msg.createdAt,
    edited: !!msg.edited,
    pinned: !!msg.pinned,
    attachment: msg.attachment || null,
    replyTo: msg.replyTo || null,
    sticker: msg.sticker || null
  }
  if (channelId) {
    const t = threadForMessage(channelId, msg.id)
    if (t) {
      out.thread = {
        id: t.id,
        name: t.name,
        archived: !!t.archived,
        messageCount: (store.messages[t.id] || []).length
      }
    }
  }
  return out
}

function threadForMessage(channelId, messageId) {
  for (const t of Object.values(store.threads || {})) {
    if (t.channelId === channelId && t.messageId === messageId) return t
  }
  return null
}

function threadSummary(t) {
  return {
    id: t.id,
    channelId: t.channelId,
    messageId: t.messageId || null,
    serverId: t.serverId,
    ownerId: t.ownerId,
    name: t.name,
    archived: !!t.archived,
    createdAt: t.createdAt,
    lastActivityAt: t.lastActivityAt || t.createdAt,
    messageCount: (store.messages[t.id] || []).length,
    memberCount: (t.memberIds || []).length
  }
}

function resolveTextTarget(id) {
  const ch = store.channels[id]
  if (ch) return ch
  return (store.threads || {})[id] || null
}

function canViewThread(user, t) {
  return (t.memberIds || []).includes(user.id) || canManage(user, store.servers[t.serverId])
}

function serverRoles(s) {
  const roles = {}
  for (const mid of s.memberIds) {
    const owner = mid === s.ownerId
    const assigned = s.memberRoles && s.memberRoles[mid]
    const custom = assigned && s.roles && s.roles[assigned]
    const admin = s.admins && s.admins.includes(mid)
    roles[mid] = owner
      ? { name: 'Owner', color: '#f0b232' }
      : custom
        ? { name: custom.name, color: custom.color }
        : admin
          ? { name: 'Admin', color: '#ed4245' }
          : null
  }
  return roles
}

function canManage(user, s) {
  return s.ownerId === user.id || !!(s.admins && s.admins.includes(user.id))
}

function serverSettings(s, viewer) {
  const manage = canManage(viewer, s)
  return {
    description: s.description || '',
    banner: s.banner || null,
    emojis: Object.values(s.emojis || {}),
    isAdmin: !!(s.admins && s.admins.includes(viewer.id)),
    memberRoles: manage ? { ...(s.memberRoles || {}) } : undefined,
    adminIds: manage ? (s.admins || []) : undefined,
    bans: manage
      ? Object.entries(s.bans || {})
          .map(([bid, b]) => ({ user: publicUser(store.users[bid]), reason: b.reason || '', at: b.at }))
          .filter((x) => x.user)
      : undefined,
    invites: manage
      ? Object.entries(store.invites || {})
          .filter(([, inv]) => inv.serverId === s.id)
          .map(([code, inv]) => ({ code, createdAt: inv.createdAt, createdBy: inv.createdBy }))
      : undefined
  }
}

function isMember(user, serverId) {
  const s = store.servers[serverId]
  return s && s.memberIds.includes(user.id)
}

function getTarget(user, target) {
  if (!target) return null
  if (target.type === 'channel') {
    const ch = store.channels[target.id]
    if (ch) {
      if (!isMember(user, ch.serverId)) return null
      return { list: store.messages[ch.id] || (store.messages[ch.id] = []) }
    }
    const t = (store.threads || {})[target.id]
    if (t) {
      if (!isMember(user, t.serverId)) return null
      if (!canViewThread(user, t)) return null
      return { list: store.messages[t.id] || (store.messages[t.id] = []), thread: t }
    }
    return null
  }
  if (target.type === 'dm') {
    const dm = store.dms[target.id]
    if (!dm || !dm.memberIds.includes(user.id)) return null
    return { list: store.dmMessages[dm.id] || (store.dmMessages[dm.id] = []) }
  }
  return null
}

function roomFor(target) {
  return target.type === 'channel' ? `ch:${target.id}` : `dm:${target.id}`
}

function voiceStateFor(serverId) {
  const result = {}
  for (const chId of Object.keys(store.channels)) {
    const ch = store.channels[chId]
    if (ch.serverId !== serverId || ch.type !== 'voice') continue
    const members = voiceRooms.get(chId)
    if (members && members.size) result[chId] = [...members]
  }
  return result
}

function broadcastVoice(serverId) {
  deliverEvent('voice:state', { serverId, channels: voiceStateFor(serverId) }, ['presence'], null, { includeSender: true })
}

// ---------- cross-tab bus ----------

try {
  if (typeof BroadcastChannel !== 'undefined') bc = new BroadcastChannel('underground_standalone')
} catch { bc = null }

function busPost(msg) {
  msg._n = Math.random().toString(36).slice(2)
  if (bc) { try { bc.postMessage(msg) } catch { /* noop */ } }
  safeSet(BUS_KEY, JSON.stringify(msg))
}

function busListen(fn) {
  if (bc) {
    bc.onmessage = (e) => { try { fn(e.data) } catch { /* noop */ } }
  }
  try {
    window.addEventListener('storage', (e) => {
      if (e.key === BUS_KEY && e.newValue) {
        try { fn(JSON.parse(e.newValue)) } catch { /* noop */ }
      }
    })
  } catch { /* noop */ }
}

function deliverEvent(event, payload, rooms, from, opts = {}) {
  const includeSender = !!opts.includeSender
  for (const s of activeSockets) {
    if (!s.connected) continue
    if (!includeSender && s === from) continue
    if (!rooms.some((r) => s.rooms.has(r))) continue
    s.emitEvent(event, payload)
  }
  if (rooms.length) busPost({ event, payload, rooms })
}

function ensureBus() {
  if (busReady) return
  busReady = true
  busListen((msg) => {
    if (!msg || !msg.event || !Array.isArray(msg.rooms)) return
    for (const s of activeSockets) {
      if (!s.connected) continue
      if (!msg.rooms.some((r) => s.rooms.has(r))) continue
      s.emitEvent(msg.event, msg.payload)
    }
  })
}

// ---------- API ----------

export function localApi(path, { method = 'GET', body } = {}) {
  loadStore()
  const token = safeGet(TOKEN_KEY)
  const user = token && store.sessions[token] ? store.users[store.sessions[token]] : null
  const send = (status, json) => {
    if (status >= 400) {
      const err = new Error(json.error || 'Request failed')
      err.status = status
      throw err
    }
    return json
  }
  const auth = () => {
    if (!user) return send(401, { error: 'Not authenticated' })
  }

  const [pathname, queryString = ''] = String(path).split('?')
  const query = new URLSearchParams(queryString)
  const parts = pathname.split('/').filter(Boolean)
  const [a, b, c, d, e] = parts

  switch (method) {
    case 'GET':
      if (a === 'health') return send(200, { ok: true })

      if (a === 'inbox') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const out = []
        const pushTarget = (list, target) => {
          for (const m of list) {
            if (m.authorId === 'system' || m.authorId === user.id) continue
            const content = m.content || ''
            const isMention = content.includes(`@${user.username}`) || content.includes('@everyone') || content.includes('@here')
            const isReply = !!(m.replyTo && m.replyTo.authorId === user.id)
            if (!isMention && !isReply) continue
            out.push({
              id: m.id,
              authorId: m.authorId,
              author: publicUser(store.users[m.authorId]),
              content: content.slice(0, 200),
              createdAt: m.createdAt,
              target,
              isMention,
              isReply
            })
          }
        }
        for (const s of Object.values(store.servers)) {
          if (!s.memberIds.includes(user.id)) continue
          for (const chId of s.channelIds) {
            const ch = store.channels[chId]
            if (ch && ch.type === 'text') {
              pushTarget(store.messages[chId] || [], { type: 'channel', id: chId, serverId: s.id })
            }
          }
          for (const t of Object.values(store.threads || {})) {
            if (t.serverId !== s.id || t.archived) continue
            if (!canViewThread(user, t)) continue
            pushTarget(store.messages[t.id] || [], { type: 'channel', id: t.id, serverId: s.id })
          }
        }
        for (const d of Object.values(store.dms)) {
          if (!d.memberIds.includes(user.id)) continue
          pushTarget(store.dmMessages[d.id] || [], { type: 'dm', id: d.id })
        }
        out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        return send(200, { notifications: out.slice(0, 50) })
      }

      if (a === 'me') {
        if (!user) return send(401, { error: 'Not authenticated' })
        return send(200, { user: selfUserLocal(user) })
      }

      if (a === 'servers') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const result = Object.values(store.servers)
          .filter((s) => s.memberIds.includes(user.id))
          .map((s) => {
            const channels = s.channelIds.map((cid) => {
              const ch = store.channels[cid]
              const msgs = store.messages[cid] || []
              const last = msgs[msgs.length - 1]
              return {
                id: ch.id,
                name: ch.name,
                topic: ch.topic,
                type: ch.type,
                categoryId: ch.categoryId || null,
                lastMessageAt: last ? last.createdAt : null
              }
            })
            return {
              id: s.id,
              name: s.name,
              icon: s.icon,
              iconMedia: s.iconMedia || null,
              description: s.description || '',
              banner: s.banner || null,
              ownerId: s.ownerId,
              isOwner: s.ownerId === user.id,
              isAdmin: !!(s.admins && s.admins.includes(user.id)),
              channels,
              threads: Object.values(store.threads || {})
                .filter((t) => t.serverId === s.id && !t.archived && canViewThread(user, t))
                .map((t) => threadSummary(t))
                .sort((a, b) => (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '')),
              categories: (s.categories || []).map((c) => ({ id: c.id, name: c.name })),
              roles: serverRoles(s),
              customRoles: Object.values(s.roles || {}),
              members: s.memberIds.map((mid) => {
                const u = store.users[mid]
                return u ? publicUser(u) : null
              }).filter(Boolean),
              ...serverSettings(s, user),
              createdAt: s.createdAt
            }
          })
        return send(200, result)
      }

      if (a === 'channels' && b && c === 'messages') {
        const ch = resolveTextTarget(b)
        if (!ch || !user) return send(404, { error: 'Channel not found' })
        if (!isMember(user, ch.serverId)) return send(403, { error: 'Not a member' })
        if (!store.channels[b] && !canViewThread(user, ch)) return send(403, { error: 'You are not in this thread' })
        const msgs = store.messages[ch.id] || []
        const limit = Math.min(parseInt(query.get('limit')) || 100, 200)
        const before = query.get('before')
        let slice = msgs
        if (before) {
          const idx = msgs.findIndex((m) => m.id === before)
          if (idx !== -1) slice = msgs.slice(0, idx)
        }
        const page = slice.slice(-limit)
        return send(200, { messages: page.map((m) => serializeMessage(m, b)), hasMore: slice.length > limit })
      }

      if (a === 'channels' && b && c === 'pins') {
        const ch = resolveTextTarget(b)
        if (!ch || !user) return send(404, { error: 'Channel not found' })
        if (!isMember(user, ch.serverId)) return send(403, { error: 'Not a member' })
        if (!store.channels[b] && !canViewThread(user, ch)) return send(403, { error: 'You are not in this thread' })
        const msgs = store.messages[ch.id] || []
        return send(200, { messages: msgs.filter((m) => m.pinned).map((m) => serializeMessage(m, b)) })
      }

      if (a === 'channels' && b && c === 'search') {
        const ch = resolveTextTarget(b)
        if (!ch || !user) return send(404, { error: 'Channel not found' })
        if (!isMember(user, ch.serverId)) return send(403, { error: 'Not a member' })
        if (!store.channels[b] && !canViewThread(user, ch)) return send(403, { error: 'You are not in this thread' })
        const q = String(query.get('q') || '').toLowerCase()
        const authorId = query.get('author')
        const msgs = (store.messages[ch.id] || []).filter((m) => {
          if (authorId && m.authorId !== authorId) return false
          if (q && !m.content.toLowerCase().includes(q)) return false
          return true
        })
        return send(200, { messages: msgs.slice(-50).map((m) => serializeMessage(m, b)) })
      }

      if (a === 'channels' && b && c === 'threads') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const ch = store.channels[b]
        if (!ch) return send(404, { error: 'Channel not found' })
        if (!isMember(user, ch.serverId)) return send(403, { error: 'Not a member' })
        const includeArchived = query.get('archived') === '1'
        const list = Object.values(store.threads || {})
          .filter((t) => t.channelId === ch.id)
          .filter((t) => includeArchived || !t.archived)
          .filter((t) => canViewThread(user, t))
          .map((t) => threadSummary(t))
          .sort((a, b) => (b.lastActivityAt || '').localeCompare(a.lastActivityAt || ''))
        return send(200, { threads: list })
      }

      if (a === 'dms') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const result = Object.values(store.dms)
          .filter((dm) => dm.memberIds.includes(user.id))
          .map((dm) => {
            const otherId = dm.memberIds.find((id) => id !== user.id)
            const other = store.users[otherId]
            const msgs = store.dmMessages[dm.id] || []
            const last = msgs[msgs.length - 1]
            return {
              id: dm.id,
              recipient: other ? publicUser(other) : null,
              lastMessageAt: last ? last.createdAt : null
            }
          })
          .filter((dm) => dm.recipient)
          .sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''))
        return send(200, result)
      }

      if (a === 'dm' && b && c === 'messages') {
        const dm = store.dms[b]
        if (!dm || !user) return send(404, { error: 'DM not found' })
        if (!dm.memberIds.includes(user.id)) return send(403, { error: 'Not a member' })
        const msgs = store.dmMessages[dm.id] || []
        const limit = Math.min(parseInt(query.get('limit')) || 100, 200)
        const before = query.get('before')
        let slice = msgs
        if (before) {
          const idx = msgs.findIndex((m) => m.id === before)
          if (idx !== -1) slice = msgs.slice(0, idx)
        }
        const page = slice.slice(-limit)
        return send(200, { messages: page.map(serializeMessage), hasMore: slice.length > limit })
      }

      if (a === 'users') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const q = String(query.get('query') || '').toLowerCase()
        const list = Object.values(store.users)
          .filter((u) => u.id !== user.id)
          .filter((u) => !q || u.username.toLowerCase().includes(q))
          .slice(0, 20)
        return send(200, list.map((u) => publicUser(u)))
      }

      if (a === 'friends') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const list = store.friendships.filter((f) => f.requester === user.id || f.target === user.id)
        const incoming = list
          .filter((f) => f.status === 'pending' && f.target === user.id)
          .map((f) => ({ id: f.id, user: publicUser(store.users[f.requester]) }))
        const outgoing = list
          .filter((f) => f.status === 'pending' && f.requester === user.id)
          .map((f) => ({ id: f.id, user: publicUser(store.users[f.target]) }))
        const friends = list
          .filter((f) => f.status === 'accepted')
          .map((f) => {
            const otherId = f.requester === user.id ? f.target : f.requester
            return publicUser(store.users[otherId])
          })
          .filter((u) => u)
          .sort((a, b) => (b.online === a.online ? a.username.localeCompare(b.username) : b.online ? 1 : -1))
        return send(200, { incoming, outgoing, friends })
      }

      if (a === 'invites' && b) {
        const inv = store.invites[b]
        if (!inv) return send(404, { error: 'Invite not found or expired' })
        const s = store.servers[inv.serverId]
        if (!s) return send(404, { error: 'Server not found or expired' })
        return send(200, { code: b, serverId: s.id, serverName: s.name, icon: s.icon, members: s.memberIds.length })
      }

      return send(404, { error: 'Not found' })

    case 'POST':
      if (a === 'register') {
        const { username, email, password } = body || {}
        if (!username || !email || !password) return send(400, { error: 'Username, email and password are required' })
        if (username.length < 2 || username.length > 32) return send(400, { error: 'Username must be 2-32 characters' })
        if (password.length < 6) return send(400, { error: 'Password must be at least 6 characters' })
        if (Object.values(store.users).some((u) => u.email.toLowerCase() === email.toLowerCase())) {
          return send(409, { error: 'An account with that email already exists' })
        }
        const id = uid('u')
        const colors = ['#5865f2', '#eb459e', '#f0b232', '#23a55a', '#3ba55d', '#ed4245', '#a06cd5', '#00a8fc']
        const salt = uid('salt').slice(0, 32)
        store.users[id] = {
          id,
          username,
          email,
          passwordHash: hashPasswordLocal(password, salt),
          salt,
          color: colors[Object.keys(store.users).length % colors.length],
          status: 'online',
          customStatus: null,
          avatar: null,
          gradient: null,
          banner: null,
          bio: null,
          pronoun: null,
          profileTheme: null,
          decoration: null,
          avatarMedia: null,
          title: null,
          emailVerified: false,
          phone: null,
          phoneVerified: false,
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorLast: null,
          backupCodes: null,
          createdAt: now()
        }
        const token = uid('t')
        store.sessions[token] = id
        persist()
        return send(200, { token, user: selfUserLocal(store.users[id]) })
      }

      if (a === 'login' && b === '2fa') {
        const { token: tmp, code } = body || {}
        const pend = store.pending2fa
        if (!pend || pend.token !== tmp || Date.now() - pend.at > 5 * 60 * 1000) {
          return send(401, { error: 'Two-factor session expired. Please log in again.' })
        }
        const target = store.users[pend.userId]
        if (!target) return send(401, { error: 'Invalid two-factor session' })
        const okCode = verifyTotpLocal(target, code) || verifyBackupCodeLocal(target, code)
        if (!okCode) return send(401, { error: 'Invalid two-factor code' })
        delete store.pending2fa
        const token = uid('t')
        store.sessions[token] = target.id
        persist()
        return send(200, { token, user: selfUserLocal(target) })
      }

      if (a === 'login') {
        const { email, password } = body || {}
        const user = Object.values(store.users).find((u) => u.email.toLowerCase() === String(email || '').toLowerCase())
        const attempted = hashPasswordLocal(String(password || ''), user && user.salt ? user.salt : '')
        if (!user || !user.passwordHash || user.passwordHash !== attempted) {
          return send(401, { error: 'Invalid email or password' })
        }
        if (user.twoFactorEnabled) {
          const tmp = uid('t2')
          store.pending2fa = { token: tmp, userId: user.id, at: Date.now() }
          persist()
          return send(200, { needs2fa: true, token: tmp })
        }
        const token = uid('t')
        store.sessions[token] = user.id
        persist()
        return send(200, { token, user: selfUserLocal(user) })
      }

      if (a === 'logout') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const token = safeGet(TOKEN_KEY)
        if (token) delete store.sessions[token]
        persist()
        return send(200, { ok: true })
      }

      if (a === '2fa' && b === 'enable') {
        if (!user) return send(401, { error: 'Not authenticated' })
        if (hashPasswordLocal(String((body || {}).password || ''), user.salt || '') !== user.passwordHash) {
          return send(401, { error: 'Incorrect password' })
        }
        if (user.twoFactorEnabled) return send(400, { error: 'Two-factor authentication is already enabled' })
        const secret = base32EncodeLocal(cryptoRandom(20))
        const plaintext = genBackupCodesLocal()
        user.pending2faSecret = secret
        user.pending2faCodes = plaintext.map(backupHashLocal)
        user.pending2faCodesAt = Date.now()
        persist()
        return send(200, { secret, uri: otpauthUriLocal(user.email, secret), backupCodes: plaintext })
      }

      if (a === '2fa' && b === 'confirm') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const secret = user.pending2faSecret
        if (!secret) return send(400, { error: 'Start setup first' })
        if (Date.now() - (user.pending2faCodesAt || 0) > 10 * 60 * 1000) {
          return send(400, { error: 'Setup expired. Please start again.' })
        }
        if (!verifyTotpLocal({ twoFactorSecret: secret }, (body || {}).code)) {
          return send(401, { error: 'Invalid code. Check your authenticator app and try again.' })
        }
        user.twoFactorEnabled = true
        user.twoFactorSecret = secret
        user.twoFactorLast = Math.floor(Date.now() / 30000)
        user.backupCodes = user.pending2faCodes
        delete user.pending2faSecret
        delete user.pending2faCodes
        delete user.pending2faCodesAt
        persist()
        return send(200, { user: selfUserLocal(user) })
      }

      if (a === '2fa' && b === 'disable') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const { password, code } = body || {}
        if (hashPasswordLocal(String(password || ''), user.salt || '') !== user.passwordHash) {
          return send(401, { error: 'Incorrect password' })
        }
        if (!user.twoFactorEnabled) return send(400, { error: 'Two-factor authentication is not enabled' })
        if (!(verifyTotpLocal(user, code) || verifyBackupCodeLocal(user, code))) {
          return send(401, { error: 'Invalid two-factor code' })
        }
        user.twoFactorEnabled = false
        user.twoFactorSecret = null
        user.twoFactorLast = null
        user.backupCodes = null
        persist()
        return send(200, { user: selfUserLocal(user) })
      }

      if (a === '2fa' && b === 'codes') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const { password, code } = body || {}
        if (hashPasswordLocal(String(password || ''), user.salt || '') !== user.passwordHash) {
          return send(401, { error: 'Incorrect password' })
        }
        if (!user.twoFactorEnabled) return send(400, { error: 'Two-factor authentication is not enabled' })
        if (!(verifyTotpLocal(user, code) || verifyBackupCodeLocal(user, code))) {
          return send(401, { error: 'Invalid two-factor code' })
        }
        const codes = genBackupCodesLocal()
        user.backupCodes = codes.map(backupHashLocal)
        persist()
        return send(200, { backupCodes: codes })
      }

      if (a === 'me' && b === 'password') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const { current, next } = body || {}
        if (hashPasswordLocal(String(current || ''), user.salt || '') !== user.passwordHash) {
          return send(401, { error: 'Current password is incorrect' })
        }
        const pw = String(next || '')
        if (pw.length < 6) return send(400, { error: 'New password must be at least 6 characters' })
        const salt = uid('salt').slice(0, 32)
        user.passwordHash = hashPasswordLocal(pw, salt)
        user.salt = salt
        persist()
        return send(200, { ok: true })
      }

      if (a === 'me' && b === 'email' && c === 'verify-send') {
        if (!user) return send(401, { error: 'Not authenticated' })
        user.emailCode = genCodeLocal()
        user.emailCodeAt = Date.now()
        persist()
        return send(200, { sent: true, simulatedCode: user.emailCode })
      }

      if (a === 'me' && b === 'email' && c === 'verify') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const { code } = body || {}
        if (!user.emailCode || !codeValidLocal(user, 'email') || user.emailCode !== String(code).trim()) {
          return send(401, { error: 'Invalid or expired code' })
        }
        user.emailVerified = true
        user.emailCode = null
        user.emailCodeAt = null
        persist()
        return send(200, { user: selfUserLocal(user) })
      }

      if (a === 'me' && b === 'email' && c === 'change') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const { newEmail, password } = body || {}
        if (hashPasswordLocal(String(password || ''), user.salt || '') !== user.passwordHash) {
          return send(401, { error: 'Incorrect password' })
        }
        const email = String(newEmail || '').toLowerCase().trim()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(400, { error: 'Enter a valid email address' })
        if (email === String(user.email || '').toLowerCase()) return send(400, { error: 'That is already your email address' })
        if (Object.values(store.users).some((u) => u.id !== user.id && String(u.email || '').toLowerCase() === email)) {
          return send(409, { error: 'An account with that email already exists' })
        }
        user.emailPending = email
        user.emailCode = genCodeLocal()
        user.emailCodeAt = Date.now()
        user.emailVerified = false
        persist()
        return send(200, { sent: true, simulatedCode: user.emailCode })
      }

      if (a === 'me' && b === 'email' && c === 'confirm') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const { code } = body || {}
        if (!user.emailPending) return send(400, { error: 'No email change pending' })
        if (!user.emailCode || !codeValidLocal(user, 'email') || user.emailCode !== String(code).trim()) {
          return send(401, { error: 'Invalid or expired code' })
        }
        user.email = user.emailPending
        user.emailPending = null
        user.emailCode = null
        user.emailCodeAt = null
        user.emailVerified = true
        persist()
        return send(200, { user: selfUserLocal(user) })
      }

      if (a === 'me' && b === 'phone' && c === 'send') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const phone = normalizePhoneLocal((body || {}).phone)
        if (!phone) return send(400, { error: 'Enter a valid phone number (7-15 digits)' })
        if (user.phone === phone) return send(400, { error: 'That is already your phone number' })
        user.phonePending = phone
        user.phoneCode = genCodeLocal()
        user.phoneCodeAt = Date.now()
        persist()
        return send(200, { sent: true, simulatedCode: user.phoneCode, phoneMasked: maskPhoneLocal(phone) })
      }

      if (a === 'me' && b === 'phone' && c === 'verify') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const { code } = body || {}
        if (!user.phonePending) return send(400, { error: 'No phone number pending' })
        if (!user.phoneCode || !codeValidLocal(user, 'phone') || user.phoneCode !== String(code).trim()) {
          return send(401, { error: 'Invalid or expired code' })
        }
        user.phone = user.phonePending
        user.phonePending = null
        user.phoneCode = null
        user.phoneCodeAt = null
        user.phoneVerified = true
        persist()
        return send(200, { user: selfUserLocal(user) })
      }

      if (a === 'me' && b === 'phone' && c === 'remove') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const { password } = body || {}
        if (hashPasswordLocal(String(password || ''), user.salt || '') !== user.passwordHash) {
          return send(401, { error: 'Incorrect password' })
        }
        if (!user.phone) return send(400, { error: 'No phone number on your account' })
        user.phone = null
        user.phoneVerified = false
        persist()
        return send(200, { user: selfUserLocal(user) })
      }

      if (a === 'servers') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const { name, icon, iconMedia } = body || {}
        if (!name || name.length < 2 || name.length > 32) return send(400, { error: 'Server name must be 2-32 characters' })
        if (iconMedia !== undefined && iconMedia !== null && typeof iconMedia !== 'string') {
          return send(400, { error: 'Server icon must be an image or an MP4/WebM clip' })
        }
        const id = uid('s')
        store.servers[id] = {
          id,
          name,
          icon: icon || '🌐',
          iconMedia: iconMedia || null,
          ownerId: user.id,
          memberIds: [user.id],
          channelIds: [],
          createdAt: now()
        }
        const channelId = uid('c')
        store.channels[channelId] = {
          id: channelId,
          serverId: id,
          name: 'general',
          topic: 'Welcome to your new server!',
          type: 'text',
          createdAt: now()
        }
        store.servers[id].channelIds.push(channelId)
        store.messages[channelId] = [{
          id: uid('m'),
          authorId: 'system',
          content: `Welcome to #general! You just created **${name}**.`,
          reactions: {},
          createdAt: now()
        }]
        persist()
        deliverEvent('server:created', { serverId: id }, ['presence'], null, { includeSender: true })
        return send(200, { server: { id, name, icon: store.servers[id].icon, iconMedia: store.servers[id].iconMedia, ownerId: user.id } })
      }

      if (a === 'servers' && b && c === 'channels') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!isMember(user, s.id)) return send(403, { error: 'Not a member' })
        const { name, type, categoryId } = body || {}
        if (!name || !/^[a-z0-9-_ ]+$/i.test(name)) {
          return send(400, { error: 'Channel names can only use letters, numbers, hyphens and underscores' })
        }
        const normalized = name.trim().toLowerCase().replace(/\s+/g, '-')
        const chType = type === 'voice' ? 'voice' : 'text'
        if (categoryId !== undefined && categoryId !== null && !(s.categories || []).some((c) => c.id === categoryId)) {
          return send(400, { error: 'Category not found' })
        }
        const id = uid('c')
        store.channels[id] = {
          id,
          serverId: s.id,
          name: normalized,
          topic: '',
          type: chType,
          categoryId: categoryId || null,
          createdAt: now()
        }
        s.channelIds.push(id)
        if (chType === 'text') {
          store.messages[id] = [{
            id: uid('m'),
            authorId: 'system',
            content: `You created #${normalized}. This is the very beginning of #${normalized}.`,
            reactions: {},
            createdAt: now()
          }]
        }
        persist()
        deliverEvent('server:membership', { serverId: s.id }, ['presence'], null, { includeSender: true })
        return send(200, { channel: store.channels[id] })
      }

      if (a === 'channels' && b && c === 'threads') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const ch = store.channels[b]
        if (!ch) return send(404, { error: 'Channel not found' })
        if (ch.type !== 'text') return send(400, { error: 'Threads can only be created in text channels' })
        if (!isMember(user, ch.serverId)) return send(403, { error: 'Not a member' })
        const name = String((body && body.name) || '').trim()
        if (name.length < 2 || name.length > 60) return send(400, { error: 'Thread name must be 2-60 characters' })
        const messageId = body && body.messageId
        if (messageId && !(store.messages[ch.id] || []).some((m) => m.id === messageId)) {
          return send(404, { error: 'Message not found' })
        }
        const id = uid('t')
        const t = {
          id,
          serverId: ch.serverId,
          channelId: ch.id,
          messageId: messageId || null,
          ownerId: user.id,
          name,
          memberIds: [user.id],
          archived: false,
          createdAt: now(),
          lastActivityAt: now()
        }
        store.threads[id] = t
        store.messages[id] = [{ id: uid('m'), authorId: 'system', content: `Thread started: **${name}**`, reactions: {}, createdAt: now() }]
        persist()
        deliverEvent('thread:update', { serverId: ch.serverId, threadId: id }, ['presence'], null, { includeSender: true })
        return send(200, { thread: threadSummary(t) })
      }

      if (a === 'threads' && b && c === 'join') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const t = (store.threads || {})[b]
        if (!t) return send(404, { error: 'Thread not found' })
        if (!isMember(user, t.serverId)) return send(403, { error: 'Not a member' })
        if (t.archived) return send(400, { error: 'Thread is archived' })
        if (!t.memberIds.includes(user.id)) {
          t.memberIds.push(user.id)
          persist()
        }
        deliverEvent('thread:update', { serverId: t.serverId, threadId: t.id }, ['presence'], null, { includeSender: true })
        return send(200, { thread: threadSummary(t) })
      }

      if (a === 'threads' && b && c === 'leave') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const t = (store.threads || {})[b]
        if (!t) return send(404, { error: 'Thread not found' })
        t.memberIds = (t.memberIds || []).filter((id) => id !== user.id)
        persist()
        deliverEvent('thread:update', { serverId: t.serverId, threadId: t.id }, ['presence'], null, { includeSender: true })
        return send(200, { ok: true })
      }

      if (a === 'servers' && b && c === 'leave') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (s.ownerId === user.id) return send(400, { error: 'The owner cannot leave their own server' })
        s.memberIds = s.memberIds.filter((id) => id !== user.id)
        persist()
        deliverEvent('server:membership', { serverId: s.id }, ['presence'], null, { includeSender: true })
        return send(200, { ok: true })
      }

      if (a === 'servers' && b && c === 'invite') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!isMember(user, s.id)) return send(403, { error: 'Not a member' })
        const code = uid('inv')
        store.invites[code] = { serverId: s.id, createdBy: user.id, createdAt: now() }
        persist()
        return send(200, { code, serverId: s.id, serverName: s.name, icon: s.icon })
      }

      if (a === 'invites' && b && c === 'join') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const inv = store.invites[b]
        if (!inv) return send(404, { error: 'Invite not found or expired' })
        const s = store.servers[inv.serverId]
        if (!s) return send(404, { error: 'Server not found or expired' })
        if (s.bans && s.bans[user.id]) return send(403, { error: 'You are banned from this server' })
        if (!s.memberIds.includes(user.id)) {
          s.memberIds.push(user.id)
          persist()
        }
        deliverEvent('server:membership', { serverId: s.id }, ['presence'], null, { includeSender: true })
        deliverEvent('server:joined', { serverId: s.id }, [`user:${user.id}`], null, { includeSender: true })
        return send(200, { serverId: s.id })
      }

      if (a === 'dms') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const { userId } = body || {}
        const other = store.users[userId]
        if (!other) return send(404, { error: 'User not found' })
        if (userId === user.id) return send(400, { error: 'You cannot DM yourself' })
        const existing = Object.values(store.dms).find(
          (dm) => dm.memberIds.includes(user.id) && dm.memberIds.includes(userId)
        )
        if (existing) return send(200, { id: existing.id, recipient: publicUser(other) })
        const id = uid('d')
        store.dms[id] = { id, memberIds: [user.id, userId], createdAt: now() }
        store.dmMessages[id] = []
        persist()
        return send(200, { id, recipient: publicUser(other) })
      }

      if (a === 'friends' && b === 'request') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const { email, userId } = body || {}
        let target = null
        if (userId) target = store.users[userId]
        else target = Object.values(store.users).find((u) => u.email.toLowerCase() === String(email || '').toLowerCase())
        if (!target) return send(404, { error: 'No user found with that email' })
        if (target.id === user.id) return send(400, { error: 'You cannot add yourself' })
        const existing = store.friendships.find(
          (f) =>
            (f.requester === user.id && f.target === target.id) ||
            (f.requester === target.id && f.target === user.id)
        )
        if (existing) {
          return send(409, { error: existing.status === 'pending' ? 'Request already sent' : 'Already friends' })
        }
        const fs = { id: uid('f'), requester: user.id, target: target.id, status: 'pending', createdAt: now() }
        store.friendships.push(fs)
        persist()
        deliverEvent('friendship:update', {}, [`user:${target.id}`, `user:${user.id}`], null, { includeSender: true })
        return send(200, { ok: true, id: fs.id })
      }

      if (a === 'friends' && b && (c === 'accept' || c === 'decline' || c === 'remove')) {
        if (!user) return send(401, { error: 'Not authenticated' })
        const list = store.friendships
        const idx = list.findIndex((x) => x.id === b)
        if (idx === -1) return send(404, { error: 'Not found' })
        const f = list[idx]
        if (c === 'accept') {
          if (f.status !== 'pending' || f.target !== user.id) return send(404, { error: 'Request not found' })
          f.status = 'accepted'
          persist()
          deliverEvent('friendship:update', {}, [`user:${f.requester}`, `user:${f.target}`], null, { includeSender: true })
        } else if (c === 'decline') {
          if (f.target !== user.id) return send(404, { error: 'Request not found' })
          list.splice(idx, 1)
          persist()
          deliverEvent('friendship:update', {}, [`user:${user.id}`], null, { includeSender: true })
        } else {
          if (f.requester !== user.id && f.target !== user.id) return send(403, { error: 'Not allowed' })
          list.splice(idx, 1)
          persist()
          deliverEvent('friendship:update', {}, [`user:${f.requester}`, `user:${f.target}`], null, { includeSender: true })
        }
        return send(200, { ok: true })
      }

      if (a === 'servers' && b && c === 'roles') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can manage roles' })
        const { name: rname, color } = body || {}
        if (!rname || rname.length < 2 || rname.length > 32) return send(400, { error: 'Role name must be 2-32 characters' })
        if (color && !/^#[0-9a-f]{6}$/i.test(color)) return send(400, { error: 'Invalid role color' })
        const rid = uid('r')
        s.roles = s.roles || {}
        s.roles[rid] = { id: rid, name: String(rname).trim(), color: color || '#5865f2' }
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        return send(200, { role: s.roles[rid] })
      }

      if (a === 'servers' && b && c === 'members' && d && e === 'kick') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can kick members' })
        if (d === s.ownerId) return send(400, { error: 'You cannot kick the owner' })
        if (d === user.id && s.ownerId !== user.id) return send(400, { error: 'Admins cannot kick themselves; use Leave Server instead' })
        if (!s.memberIds.includes(d)) return send(404, { error: 'Member not found' })
        s.memberIds = s.memberIds.filter((id) => id !== d)
        if (s.memberRoles) delete s.memberRoles[d]
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        deliverEvent('server:kicked', { serverId: s.id }, [`user:${d}`], null, { includeSender: true })
        return send(200, { ok: true })
      }

      if (a === 'servers' && b && c === 'members' && d && e === 'admin') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (s.ownerId !== user.id) return send(403, { error: 'Only the owner can manage admins' })
        if (!s.memberIds.includes(d)) return send(404, { error: 'Member not found' })
        const { admin } = body || {}
        s.admins = s.admins || []
        if (admin) {
          if (!s.admins.includes(d)) s.admins.push(d)
        } else {
          s.admins = s.admins.filter((id) => id !== d)
        }
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        deliverEvent('server:updated', { serverId: s.id }, [`user:${d}`], null, { includeSender: true })
        return send(200, { ok: true })
      }

      if (a === 'servers' && b && c === 'channels' && d && e === 'move') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can manage channels' })
        const ch = store.channels[d]
        if (!ch || ch.serverId !== s.id) return send(404, { error: 'Channel not found' })
        const { dir } = body || {}
        const idx = s.channelIds.indexOf(ch.id)
        if (dir === 'up' && idx > 0) {
          s.channelIds.splice(idx, 1)
          s.channelIds.splice(idx - 1, 0, ch.id)
        } else if (dir === 'down' && idx < s.channelIds.length - 1) {
          s.channelIds.splice(idx, 1)
          s.channelIds.splice(idx + 1, 0, ch.id)
        }
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        return send(200, { ok: true })
      }

      if (a === 'servers' && b && c === 'emoji') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can manage emoji' })
        const { name: ename, emoji: eemoji, media } = body || {}
        const n = String(ename || '').trim()
        if (!/^[a-zA-Z0-9_+]{2,6}$/.test(n)) return send(400, { error: 'Emoji name must be 2-6 letters, numbers, _ or +' })
        if (media !== undefined && media !== null && typeof media !== 'string') {
          return send(400, { error: 'Custom emoji media must be an image or a short clip' })
        }
        if (!eemoji && !media) return send(400, { error: 'Provide an emoji or an image/clip' })
        s.emojis = s.emojis || {}
        const eid = uid('e')
        s.emojis[eid] = { id: eid, name: n, emoji: eemoji ? String(eemoji).slice(0, 8) : null, media: media || null }
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        return send(200, { emoji: s.emojis[eid] })
      }

      if (a === 'servers' && b && c === 'bans') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can ban members' })
        const uid2 = (body && body.userId) || ''
        if (!uid2 || !store.users[uid2]) return send(404, { error: 'User not found' })
        if (uid2 === s.ownerId) return send(400, { error: 'You cannot ban the owner' })
        const reason = String((body && body.reason) || '').slice(0, 200)
        s.bans = s.bans || {}
        s.bans[uid2] = { reason, at: now() }
        if (s.memberIds.includes(uid2)) {
          s.memberIds = s.memberIds.filter((id) => id !== uid2)
          if (s.memberRoles) delete s.memberRoles[uid2]
          if (s.admins) s.admins = s.admins.filter((id) => id !== uid2)
        }
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        deliverEvent('server:kicked', { serverId: s.id, banned: true }, [`user:${uid2}`], null, { includeSender: true })
        return send(200, { ok: true })
      }

      if (a === 'servers' && b && c === 'members' && d && e === 'delete-account') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (s.ownerId !== user.id) return send(403, { error: 'Only the server owner can delete accounts' })
        if (d === s.ownerId) return send(400, { error: 'You cannot delete the owner account' })
        if (!s.memberIds.includes(d)) return send(404, { error: 'Member not found' })
        if (!store.users[d]) return send(404, { error: 'Account not found' })
        deleteUserAccountLocal(store, d)
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        deliverEvent('server:kicked', { serverId: s.id, banned: true }, [`user:${d}`], null, { includeSender: true })
        return send(200, { ok: true })
      }

      if (a === 'servers' && b && c === 'categories') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can manage categories' })
        const catName = String((body && body.name) || '').trim().slice(0, 32)
        if (!catName) return send(400, { error: 'Category name is required' })
        const catId = uid('cat')
        s.categories = s.categories || []
        s.categories.push({ id: catId, name: catName })
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        return send(200, { category: { id: catId, name: catName } })
      }

      if (a === 'servers' && b && c === 'categories' && d && e === 'reorder') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can manage categories' })
        const { orderedIds } = body || {}
        if (!Array.isArray(orderedIds)) return send(400, { error: 'orderedIds must be an array' })
        const cats = s.categories || []
        if (orderedIds.length !== cats.length || cats.some((c) => !orderedIds.includes(c.id))) {
          return send(400, { error: 'orderedIds must include every category exactly once' })
        }
        const byId = new Map(cats.map((c) => [c.id, c]))
        s.categories = orderedIds.map((id) => byId.get(id))
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        return send(200, { ok: true })
      }

      if (a === 'servers' && b && c === 'channels' && d && e === 'reorder') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can manage channels' })
        const { orderedIds } = body || {}
        if (!Array.isArray(orderedIds)) return send(400, { error: 'orderedIds must be an array' })
        if (orderedIds.length !== s.channelIds.length || s.channelIds.some((id) => !orderedIds.includes(id))) {
          return send(400, { error: 'orderedIds must include every channel exactly once' })
        }
        s.channelIds = orderedIds
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        return send(200, { ok: true })
      }

      return send(404, { error: 'Not found' })

    case 'PATCH':
      if (a === 'me') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const { username, status, customStatus, color, avatar, gradient, banner, bio, pronoun, profileTheme, decoration, avatarMedia } = body || {}
        if (username) {
          if (username.length < 2 || username.length > 32) return send(400, { error: 'Username must be 2-32 characters' })
          user.username = username
        }
        if (['online', 'idle', 'dnd'].includes(status)) user.status = status
        if (typeof customStatus === 'string') user.customStatus = customStatus.slice(0, 128) || null
        if (color && /^#[0-9a-f]{6}$/i.test(color)) user.color = color
        if (typeof avatar === 'string') user.avatar = avatar.slice(0, 8) || null
        if (typeof gradient === 'string') user.gradient = gradient.slice(0, 32) || null
        if (typeof banner === 'string') user.banner = banner.slice(0, 32) || null
        if (typeof bio === 'string') user.bio = bio.slice(0, 300) || null
        if (typeof pronoun === 'string') user.pronoun = pronoun.slice(0, 32) || null
        if (typeof profileTheme === 'string') user.profileTheme = profileTheme.slice(0, 32) || null
        if (typeof decoration === 'string') user.decoration = decoration.slice(0, 32) || null
        if (typeof avatarMedia === 'string') {
          if (avatarMedia.length > 12 * 1024 * 1024) return send(400, { error: 'Avatar media must be an image or an MP4/WebM clip (max 8 MB)' })
          user.avatarMedia = avatarMedia
        } else if (avatarMedia === null) {
          user.avatarMedia = null
        }
        persist()
        deliverEvent('presence', {
          userId: user.id,
          online: isOnline(user.id),
          status: user.status,
          customStatus: user.customStatus,
          username: user.username,
          color: user.color,
          avatar: user.avatar,
          gradient: user.gradient,
          banner: user.banner,
          bio: user.bio,
          pronoun: user.pronoun,
          profileTheme: user.profileTheme,
          decoration: user.decoration
        }, ['presence'], null, { includeSender: true })
        return send(200, { user: selfUserLocal(user) })
      }
      if (a === 'servers') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!isMember(user, s.id)) return send(403, { error: 'Not a member' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can edit server settings' })
        const { name, description, banner, icon, iconMedia } = body || {}
        if (name !== undefined) {
          if (name.length < 2 || name.length > 32) return send(400, { error: 'Server name must be 2-32 characters' })
          s.name = name
        }
        if (typeof description === 'string') s.description = description.slice(0, 300)
        if (typeof banner === 'string') s.banner = banner.slice(0, 32) || null
        if (typeof icon === 'string') s.icon = icon.slice(0, 8) || '🌐'
        if (iconMedia !== undefined) {
          if (iconMedia !== null && typeof iconMedia !== 'string') {
            return send(400, { error: 'Server icon must be an image or an MP4/WebM clip' })
          }
          s.iconMedia = iconMedia
        }
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        return send(200, { server: { id: s.id, name: s.name, icon: s.icon, iconMedia: s.iconMedia, description: s.description, banner: s.banner, ownerId: s.ownerId } })
      }

      if (a === 'threads' && b) {
        if (!user) return send(401, { error: 'Not authenticated' })
        const t = (store.threads || {})[b]
        if (!t) return send(404, { error: 'Thread not found' })
        if (!isMember(user, t.serverId)) return send(403, { error: 'Not a member' })
        if (!canViewThread(user, t)) return send(403, { error: 'You are not in this thread' })
        const s = store.servers[t.serverId]
        const isMod = canManage(user, s)
        const name = body && body.name
        const archived = body && body.archived
        if (name !== undefined) {
          if (!isMod && t.ownerId !== user.id) return send(403, { error: 'Only the thread owner or admins can rename threads' })
          const n = String(name).trim()
          if (n.length < 2 || n.length > 60) return send(400, { error: 'Thread name must be 2-60 characters' })
          t.name = n
        }
        if (archived !== undefined) {
          if (!isMod) return send(403, { error: 'Only the owner or admins can archive threads' })
          t.archived = !!archived
        }
        persist()
        deliverEvent('thread:update', { serverId: t.serverId, threadId: t.id }, ['presence'], null, { includeSender: true })
        return send(200, { thread: threadSummary(t) })
      }

      if (a === 'servers' && b && c === 'roles' && d) {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can manage roles' })
        const role = s.roles && s.roles[d]
        if (!role) return send(404, { error: 'Role not found' })
        const { name: rname, color } = body || {}
        if (rname !== undefined && (!rname || rname.length < 2 || rname.length > 32)) return send(400, { error: 'Role name must be 2-32 characters' })
        if (color !== undefined && !/^#[0-9a-f]{6}$/i.test(color)) return send(400, { error: 'Invalid role color' })
        if (rname !== undefined) role.name = String(rname).trim()
        if (color !== undefined) role.color = color
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        return send(200, { role })
      }

      if (a === 'servers' && b && c === 'members' && d && e === 'role') {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can manage members' })
        if (!s.memberIds.includes(d)) return send(404, { error: 'Member not found' })
        if (d === s.ownerId) return send(400, { error: 'You cannot change the owner role' })
        const { roleId } = body || {}
        s.memberRoles = s.memberRoles || {}
        if (roleId === null || roleId === undefined) delete s.memberRoles[d]
        else if (s.roles && s.roles[roleId]) s.memberRoles[d] = roleId
        else return send(400, { error: 'Role not found' })
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        deliverEvent('server:updated', { serverId: s.id }, [`user:${d}`], null, { includeSender: true })
        return send(200, { ok: true })
      }

      if (a === 'servers' && b && c === 'channels' && d) {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can manage channels' })
        const ch = store.channels[d]
        if (!ch || ch.serverId !== s.id) return send(404, { error: 'Channel not found' })
        const { name: cname, topic, categoryId } = body || {}
        if (cname !== undefined) {
          if (!cname || !/^[a-z0-9-_ ]+$/i.test(cname)) {
            return send(400, { error: 'Channel names can only use letters, numbers, hyphens and underscores' })
          }
          ch.name = String(cname).trim().toLowerCase().replace(/\s+/g, '-')
        }
        if (typeof topic === 'string') ch.topic = topic.slice(0, 200)
        if (categoryId !== undefined) {
          if (categoryId === null || (s.categories || []).some((c) => c.id === categoryId)) {
            ch.categoryId = categoryId
          } else {
            return send(400, { error: 'Category not found' })
          }
        }
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        return send(200, { channel: { id: ch.id, name: ch.name, topic: ch.topic, type: ch.type, categoryId: ch.categoryId || null } })
      }

      if (a === 'servers' && b && c === 'categories' && d) {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can manage categories' })
        const cat = (s.categories || []).find((c) => c.id === d)
        if (!cat) return send(404, { error: 'Category not found' })
        const catName = String((body && body.name) || '').trim().slice(0, 32)
        if (catName) cat.name = catName
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        return send(200, { category: { id: cat.id, name: cat.name } })
      }

      return send(404, { error: 'Not found' })

    case 'DELETE':
      if (a === 'servers' && b) {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (s.ownerId !== user.id) return send(403, { error: 'Only the owner can delete this server' })
        for (const cid of s.channelIds) {
          delete store.channels[cid]
          delete store.messages[cid]
        }
        for (const [code, inv] of Object.entries(store.invites || {})) {
          if (inv.serverId === s.id) delete store.invites[code]
        }
        delete store.servers[s.id]
        persist()
        deliverEvent('server:deleted', { serverId: s.id }, ['presence'], null, { includeSender: true })
        return send(200, { ok: true })
      }

      if (a === 'servers' && b && c === 'roles' && d) {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can manage roles' })
        if (!s.roles || !s.roles[d]) return send(404, { error: 'Role not found' })
        delete s.roles[d]
        for (const mid of Object.keys(s.memberRoles || {})) {
          if (s.memberRoles[mid] === d) delete s.memberRoles[mid]
        }
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        return send(200, { ok: true })
      }

      if (a === 'servers' && b && c === 'channels' && d) {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can manage channels' })
        const ch = store.channels[d]
        if (!ch || ch.serverId !== s.id) return send(404, { error: 'Channel not found' })
        s.channelIds = s.channelIds.filter((id) => id !== ch.id)
        delete store.channels[ch.id]
        delete store.messages[ch.id]
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        return send(200, { ok: true })
      }

      if (a === 'threads' && b) {
        if (!user) return send(401, { error: 'Not authenticated' })
        const t = (store.threads || {})[b]
        if (!t) return send(404, { error: 'Thread not found' })
        const s = store.servers[t.serverId]
        if (!s) return send(404, { error: 'Server not found' })
        if (!isMember(user, t.serverId)) return send(403, { error: 'Not a member' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can delete threads' })
        delete store.threads[t.id]
        delete store.messages[t.id]
        persist()
        deliverEvent('thread:update', { serverId: s.id, threadId: t.id }, ['presence'], null, { includeSender: true })
        return send(200, { ok: true })
      }

      if (a === 'servers' && b && c === 'categories' && d) {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can manage categories' })
        s.categories = (s.categories || []).filter((c) => c.id !== d)
        for (const ch of Object.values(store.channels)) {
          if (ch.serverId === s.id && ch.categoryId === d) ch.categoryId = null
        }
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        return send(200, { ok: true })
      }

      if (a === 'servers' && b && c === 'invites' && d) {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can manage invites' })
        const inv = (store.invites || {})[d]
        if (!inv || inv.serverId !== s.id) return send(404, { error: 'Invite not found' })
        delete store.invites[d]
        persist()
        return send(200, { ok: true })
      }

      if (a === 'servers' && b && c === 'emoji' && d) {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can manage emoji' })
        if (!s.emojis || !s.emojis[d]) return send(404, { error: 'Emoji not found' })
        delete s.emojis[d]
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        return send(200, { ok: true })
      }

      if (a === 'servers' && b && c === 'bans' && d) {
        if (!user) return send(401, { error: 'Not authenticated' })
        const s = store.servers[b]
        if (!s) return send(404, { error: 'Server not found' })
        if (!canManage(user, s)) return send(403, { error: 'Only the owner or admins can manage bans' })
        if (!s.bans || !s.bans[d]) return send(404, { error: 'Ban not found' })
        delete s.bans[d]
        persist()
        deliverEvent('server:updated', { serverId: s.id }, ['presence'], null, { includeSender: true })
        return send(200, { ok: true })
      }

      return send(404, { error: 'Not found' })

    default:
      return send(405, { error: 'Method not allowed' })
  }
}

// ---------- socket ----------

export function createLocalSocket({ auth }) {
  loadStore()
  const token = auth && auth.token
  const userId = token ? store.sessions[token] : null

  const socket = {
    connected: false,
    rooms: new Set(),
    listeners: {},
    data: { lastMessageAt: 0, typing: new Map(), voiceChannel: null },
    userId: userId || null,
    on(ev, cb) {
      (this.listeners[ev] = this.listeners[ev] || []).push(cb)
      return this
    },
    off(ev, cb) {
      const l = this.listeners[ev]
      if (!l) return
      const i = l.indexOf(cb)
      if (i >= 0) l.splice(i, 1)
    },
    emitEvent(ev, payload) {
      const l = this.listeners[ev]
      if (l) for (const cb of [...l]) cb(payload)
    },
    join(room) {
      this.rooms.add(room)
    },
    emit(ev, payload, ack) {
      handleEmit(this, ev, payload, ack)
    },
    disconnect() {
      handleDisconnect(this)
    }
  }

  if (!userId) {
    setTimeout(() => socket.emitEvent('connect_error', new Error('Not authenticated')), 0)
    return socket
  }

  activeSockets.push(socket)
  setTimeout(() => {
    if (socket.disconnected) return
    socket.connected = true
    socket.join('presence')
    socket.join('user:' + userId)
    const user = store.users[userId]
    const counts = store.onlineCounts = store.onlineCounts || {}
    const wasOffline = !counts[userId]
    counts[userId] = (counts[userId] || 0) + 1
    persist()
    if (wasOffline) {
      deliverEvent('presence', { userId, online: true, status: user.status }, ['presence'], socket, { includeSender: true })
    }
    socket.emitEvent('connect')
  }, 30)

  return socket
}

function handleDisconnect(socket) {
  if (socket.disconnected) return
  socket.disconnected = true
  socket.connected = false
  const userId = socket.userId

  const chId = socket.data.voiceChannel
  if (chId) {
    const room = voiceRooms.get(chId)
    if (room) {
      room.delete(userId)
      if (!room.size) voiceRooms.delete(chId)
      const ch = store.channels[chId]
      if (ch) broadcastVoice(ch.serverId)
    }
  }
  for (const t of socket.data.typing.values()) clearTimeout(t)
  socket.data.typing.clear()

  const idx = activeSockets.indexOf(socket)
  if (idx >= 0) activeSockets.splice(idx, 1)

  if (userId) {
    const counts = store.onlineCounts = store.onlineCounts || {}
    counts[userId] = Math.max(0, (counts[userId] || 1) - 1)
    const user = store.users[userId]
    if (counts[userId]) {
      persist()
    } else {
      delete counts[userId]
      persist()
      if (user) {
        deliverEvent('presence', { userId, online: false, status: user.status }, ['presence'], socket, { includeSender: true })
      }
    }
  }
}

function handleEmit(socket, event, payload, ack) {
  loadStore()
  const user = socket.userId ? store.users[socket.userId] : null
  if (!user) return ack && ack({ error: 'Not authenticated' })

  switch (event) {
    case 'room:join': {
      const t = getTarget(user, payload && payload.target)
      if (t) socket.join(roomFor(payload.target))
      break
    }

    case 'chat:send': {
      const nowMs = Date.now()
      if (nowMs - socket.data.lastMessageAt < 400) {
        return ack && ack({ error: 'You are sending messages too fast' })
      }
      socket.data.lastMessageAt = nowMs
      const content = String((payload && payload.content) || '').slice(0, 2000)
      const attachment = payload && payload.attachment
      const sticker = payload && payload.sticker
      if (!content.trim() && !attachment && !sticker) return ack && ack({ error: 'Message is empty' })
      const target = getTarget(user, payload && payload.target)
      if (!target) return ack && ack({ error: 'Invalid target' })

      let stickerOut = null
      if (sticker) {
        const name = String(sticker.name || '').slice(0, 40)
        const emoji = String(sticker.emoji || '').slice(0, 8)
        if (name && emoji) stickerOut = { name, emoji }
      }

      let attachmentOut = null
      if (attachment && attachment.dataUrl) {
        if (String(attachment.dataUrl).length > 4 * 1024 * 1024) {
          return ack && ack({ error: 'Attachment is too large (max 4 MB)' })
        }
        attachmentOut = {
          name: String(attachment.name || 'file').slice(0, 100),
          type: String(attachment.type || 'application/octet-stream').slice(0, 60),
          size: Number(attachment.size) || 0,
          dataUrl: attachment.dataUrl
        }
      }

      const msg = {
        id: uid('m'),
        authorId: user.id,
        content,
        reactions: {},
        createdAt: now(),
        attachment: attachmentOut,
        sticker: stickerOut
      }
      if (payload.replyTo && payload.replyTo.messageId) {
        const ref = target.list.find((m) => m.id === payload.replyTo.messageId)
        if (ref) {
          const refAuthor = store.users[ref.authorId]
          msg.replyTo = {
            messageId: ref.id,
            authorId: ref.authorId,
            authorName: refAuthor ? refAuthor.username : 'Unknown',
            content: (ref.content || '').slice(0, 120)
          }
        }
      }
      target.list.push(msg)
      if (target.thread) {
        target.thread.lastActivityAt = now()
        if (!target.thread.memberIds.includes(user.id)) target.thread.memberIds.push(user.id)
        deliverEvent('thread:update', { serverId: target.thread.serverId, threadId: target.thread.id }, ['presence'], null, { includeSender: true })
      }
      persist()

      const serialized = serializeMessage(msg, payload.target && payload.target.id)
      serialized.target = payload.target
      deliverEvent('chat:message', serialized, [roomFor(payload.target)], socket, { includeSender: false })
      ack && ack({ message: serialized })
      break
    }

    case 'chat:edit': {
      const target = getTarget(user, payload && payload.target)
      if (!target) return ack && ack({ error: 'Invalid target' })
      const msg = target.list.find((m) => m.id === payload.messageId)
      if (!msg) return ack && ack({ error: 'Message not found' })
      if (msg.authorId !== user.id) return ack && ack({ error: 'You can only edit your own messages' })
      msg.content = String(payload.content || '').slice(0, 2000)
      msg.edited = true
      persist()
      deliverEvent('chat:edit', { target: payload.target, messageId: msg.id, content: msg.content, edited: true }, [roomFor(payload.target)], socket, { includeSender: true })
      ack && ack({ ok: true })
      break
    }

    case 'chat:delete': {
      const target = getTarget(user, payload && payload.target)
      if (!target) return ack && ack({ error: 'Invalid target' })
      const idx = target.list.findIndex((m) => m.id === payload.messageId)
      if (idx === -1) return ack && ack({ error: 'Message not found' })
      const msg = target.list[idx]
      if (msg.authorId !== user.id) return ack && ack({ error: 'You can only delete your own messages' })
      target.list.splice(idx, 1)
      persist()
      deliverEvent('chat:delete', { target: payload.target, messageId: msg.id }, [roomFor(payload.target)], socket, { includeSender: true })
      ack && ack({ ok: true })
      break
    }

    case 'react:add':
    case 'react:remove': {
      const target = getTarget(user, payload && payload.target)
      if (!target) return ack && ack({ error: 'Invalid target' })
      const msg = target.list.find((m) => m.id === payload.messageId)
      if (!msg) return ack && ack({ error: 'Message not found' })
      const emoji = String(payload.emoji || '').slice(0, 8)
      if (!emoji) return ack && ack({ error: 'Invalid emoji' })
      if (event === 'react:add') {
        msg.reactions[emoji] = msg.reactions[emoji] || []
        if (!msg.reactions[emoji].includes(user.id)) msg.reactions[emoji].push(user.id)
      } else {
        if (msg.reactions[emoji]) {
          msg.reactions[emoji] = msg.reactions[emoji].filter((id) => id !== user.id)
          if (!msg.reactions[emoji].length) delete msg.reactions[emoji]
        }
      }
      persist()
      deliverEvent('react', {
        target: payload.target,
        messageId: msg.id,
        emoji,
        userId: user.id,
        add: event === 'react:add'
      }, [roomFor(payload.target)], socket, { includeSender: true })
      ack && ack({ ok: true })
      break
    }

    case 'typing:start': {
      const target = getTarget(user, payload && payload.target)
      if (!target) break
      deliverEvent('typing', { target: payload.target, userId: user.id, username: user.username }, [roomFor(payload.target)], socket, { includeSender: false })
      if (socket.data.typing.has(payload.target.id)) clearTimeout(socket.data.typing.get(payload.target.id))
      const t = setTimeout(() => {
        deliverEvent('typing:clear', { target: payload.target, userId: user.id }, [roomFor(payload.target)], socket, { includeSender: false })
        socket.data.typing.delete(payload.target.id)
      }, 4000)
      socket.data.typing.set(payload.target.id, t)
      break
    }

    case 'pin:add':
    case 'pin:remove': {
      const target = getTarget(user, payload && payload.target)
      if (!target) return ack && ack({ error: 'Invalid target' })
      const msg = target.list.find((m) => m.id === payload.messageId)
      if (!msg) return ack && ack({ error: 'Message not found' })
      msg.pinned = event === 'pin:add'
      persist()
      deliverEvent('pin:update', { target: payload.target, messageId: msg.id, pinned: msg.pinned }, [roomFor(payload.target)], socket, { includeSender: true })
      ack && ack({ ok: true })
      break
    }

    case 'voice:join': {
      const ch = store.channels[payload && payload.channelId]
      if (!ch || ch.type !== 'voice') return ack && ack({ error: 'Invalid voice channel' })
      if (!isMember(user, ch.serverId)) return ack && ack({ error: 'Not a member' })
      for (const [chId, members] of voiceRooms) {
        if (members.has(user.id) && chId !== ch.id) members.delete(user.id)
      }
      voiceRooms.set(ch.id, voiceRooms.get(ch.id) || new Set())
      voiceRooms.get(ch.id).add(user.id)
      socket.join(`voice:${ch.id}`)
      socket.data.voiceChannel = ch.id
      broadcastVoice(ch.serverId)
      ack && ack({ ok: true, members: [...voiceRooms.get(ch.id)] })
      break
    }

    case 'voice:leave': {
      const chId = payload && payload.channelId
      const room = voiceRooms.get(chId)
      if (room) {
        room.delete(user.id)
        if (!room.size) voiceRooms.delete(chId)
      }
      socket.data.voiceChannel = null
      if (chId) {
        const ch = store.channels[chId]
        if (ch) broadcastVoice(ch.serverId)
      }
      ack && ack({ ok: true })
      break
    }

    case 'voice:speaking': {
      const chId = socket.data.voiceChannel
      if (!chId) break
      const ch = store.channels[chId]
      if (!ch) break
      deliverEvent('voice:speaking', { channelId: chId, userId: user.id, speaking: !!payload.speaking }, [`voice:${chId}`], socket, { includeSender: true })
      break
    }

    case 'call:invite': {
      const to = payload && payload.to
      const targetUser = to ? store.users[to] : null
      if (!targetUser) return ack && ack({ error: 'User not found' })
      if (!canCallUsers(user.id, to)) return ack && ack({ error: 'You must be friends to call' })
      const call = (payload && payload.call) || {}
      if (!call.roomId) return ack && ack({ error: 'Missing call' })
      deliverEvent('call:invite', {
        from: user.id,
        user: publicUser(user),
        call: { roomId: String(call.roomId).slice(0, 120), kind: call.kind === 'voice' ? 'voice' : 'dm', dmId: call.dmId || null }
      }, [`user:${to}`], socket, { includeSender: true })
      ack && ack({ ok: true })
      break
    }

    case 'call:accept':
    case 'call:decline': {
      const to = payload && payload.to
      if (!to || !store.users[to]) return ack && ack({ error: 'User not found' })
      deliverEvent(event, {
        from: user.id,
        user: publicUser(user),
        roomId: String((payload && payload.roomId) || '')
      }, [`user:${to}`], socket, { includeSender: true })
      ack && ack({ ok: true })
      break
    }

    case 'call:signal': {
      const to = payload && payload.to
      if (!to || !store.users[to]) break
      deliverEvent('call:signal', {
        from: user.id,
        roomId: String((payload && payload.roomId) || ''),
        data: (payload && payload.data) || {}
      }, [`user:${to}`], socket, { includeSender: true })
      break
    }

    case 'call:leave': {
      const to = payload && payload.to
      if (to && store.users[to]) {
        deliverEvent('call:leave', { from: user.id, roomId: String((payload && payload.roomId) || '') }, [`user:${to}`], socket, { includeSender: true })
      }
      break
    }

    default:
      break
  }
}

function canCallUsers(a, b) {
  const shareDm = Object.values(store.dms).some((d) => d.memberIds.includes(a) && d.memberIds.includes(b))
  const friends = store.friendships.some(
    (f) =>
      f.status === 'accepted' &&
      ((f.requester === a && f.target === b) || (f.requester === b && f.target === a))
  )
  return shareDm || friends
}

// ---------- seed ----------

function seed() {
  const t = now()
  const mkUser = (username, email, password, color, customStatus, extra = {}) => {
    const id = uid('u')
    const salt = extra.salt || uid('salt').slice(0, 32)
    store.users[id] = {
      id,
      username,
      email,
      passwordHash: extra.passwordHash || hashPasswordLocal(password, salt),
      salt,
      color,
      status: 'online',
      customStatus: customStatus || null,
      avatar: extra.avatar || null,
      gradient: extra.gradient || null,
      banner: extra.banner || null,
      bio: extra.bio || null,
      pronoun: extra.pronoun || null,
      profileTheme: extra.profileTheme || null,
      decoration: extra.decoration || null,
      avatarMedia: extra.avatarMedia || null,
      title: extra.title || null,
      badges: extra.badges || null,
      emailVerified: true,
      phone: null,
      phoneVerified: false,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorLast: null,
      backupCodes: null,
      createdAt: t
    }
    return id
  }

  const kmoon = mkUser(decText('enc:2908095959'), decText('enc:0906145344145c53000054070b25050954085d4d50595a'), '', '#ffd700', 'platform maintainer', {
    avatar: '🕳️',
    gradient: 'gold',
    banner: 'gold',
    pronoun: 'they/them',
    bio: 'Founder & platform developer. Built the underground from the ground up.',
    profileTheme: 'gold',
    decoration: 'crown',
    salt: '704a2ad6922f7af5ed2ff047875b2ae1',
    passwordHash: 'f6eabcf75e0ec672fa7ccfb1dd7c3288950c9c2eb720686c78bb488be0931a07',
    title: { name: 'Platform Developer', color: '#ffd700', icon: '🛠️' },
    badges: [
      { id: 'owner', icon: '👑', name: 'Underground Owner', hint: 'Owner and founder of Underground. Built the platform from the ground up.' }
    ]
  })

  const serverId = uid('s')
  store.servers[serverId] = {
    id: serverId,
    name: 'Underground HQ',
    icon: '🕳️',
    iconMedia: null,
    description: 'The hidden place. 🕳️',
    banner: '🌑',
    ownerId: kmoon,
    admins: [],
    memberIds: [kmoon],
    channelIds: [],
    roles: {},
    memberRoles: {},
    bans: {},
    emojis: {},
    createdAt: t
  }

  const mkChannel = (name, topic, type = 'text') => {
    const id = uid('c')
    store.channels[id] = { id, serverId, name, topic, type, createdAt: t }
    store.servers[serverId].channelIds.push(id)
    return id
  }

  const general = mkChannel('general', 'Talk about anything at all')
  const announcements = mkChannel('announcements', 'Official news from the staff')
  const gaming = mkChannel('gaming', 'Game nights, ranks and clips')
  const memes = mkChannel('memes', 'Certified bangers only')
  const music = mkChannel('music', 'What are we listening to?')
  const help = mkChannel('help', 'Ask for help here')
  const offTopic = mkChannel('off-topic', 'Anything that doesn\u2019t fit elsewhere')
  const voice = mkChannel('General Voice', 'Hang out and talk', 'voice')
  const gamesVoice = mkChannel('Games', 'We play games', 'voice')

  const infoCat = uid('cat')
  const funCat = uid('cat')
  const vcCat = uid('cat')
  store.servers[serverId].categories = [
    { id: infoCat, name: 'Info' },
    { id: funCat, name: 'Fun & Games' },
    { id: vcCat, name: 'Voice' }
  ]
  const setCat = (chId, catId) => { store.channels[chId].categoryId = catId }
  setCat(announcements, infoCat)
  setCat(general, infoCat)
  setCat(gaming, funCat)
  setCat(memes, funCat)
  setCat(music, funCat)
  setCat(help, funCat)
  setCat(offTopic, funCat)
  setCat(voice, vcCat)
  setCat(gamesVoice, vcCat)

  const mkMsg = (channelId, authorId, content, extra = {}) => {
    const msg = {
      id: uid('m'),
      channelId,
      authorId,
      content,
      reactions: {},
      createdAt: extra.createdAt || t
    }
    if (extra.pinned) msg.pinned = true
    if (extra.replyTo) msg.replyTo = extra.replyTo
    store.messages[channelId] = store.messages[channelId] || []
    store.messages[channelId].push(msg)
    return msg
  }
  const welcome = (channelId) => {
    mkMsg(channelId, 'system', 'Welcome to the channel. This is the beginning of the history.', { createdAt: t })
  }

  welcome(announcements)
  mkMsg(announcements, kmoon, 'Welcome to **Underground HQ**! 🕳️')
  welcome(general)
  mkMsg(general, kmoon, 'hey, this is the general channel')
  welcome(gaming)
  mkMsg(gaming, kmoon, 'game nights go here')
  welcome(memes)
  mkMsg(memes, kmoon, 'memes only')
  welcome(music)
  mkMsg(music, kmoon, 'what are we listening to?')
  welcome(help)
  mkMsg(help, kmoon, 'ask for help here')
  welcome(offTopic)
  mkMsg(offTopic, kmoon, 'anything that doesn\u2019t fit elsewhere')

  store.friendships = []
  store.invites = store.invites || {}

  persist()
}

// Best-effort cleanup when the tab closes so presence stays honest.
try {
  window.addEventListener('pagehide', () => {
    for (const s of activeSockets) handleDisconnect(s)
  })
} catch { /* noop */ }

ensureBus()

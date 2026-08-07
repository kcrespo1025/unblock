import express from 'express'
import http from 'node:http'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import { getStore, persist, persistNow, uid, now, migrateStore } from './store.js'
import { seedIfEmpty } from './seed.js'

const PORT = process.env.PORT || 4000
seedIfEmpty()
migrateStore()

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '16mb' }))

// Simple in-memory rate limiter for mutating requests (per IP).
const rateBuckets = new Map()
function rateLimit(limit = 200, windowMs = 60000) {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?'
    const nowMs = Date.now()
    let b = rateBuckets.get(ip)
    if (!b || nowMs > b.resetAt) {
      b = { count: 0, resetAt: nowMs + windowMs }
      rateBuckets.set(ip, b)
    }
    b.count++
    if (b.count > limit) return res.status(429).json({ error: 'Too many requests — slow down' })
    next()
  }
}
app.use(rateLimit())

// Gzip JSON API responses when the client accepts gzip. Large media payloads
// (multi-MB base64) are sent uncompressed to avoid blocking the event loop.
app.use((req, res, next) => {
  if (!/\bgzip\b/.test(req.headers['accept-encoding'] || '')) return next()
  const json = res.json.bind(res)
  res.json = (body) => {
    const payload = JSON.stringify(body)
    if (payload.length >= 2 * 1024 * 1024) return json(body)
    const buf = zlib.gzipSync(Buffer.from(payload))
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Encoding', 'gzip')
    res.setHeader('Content-Length', buf.length)
    res.end(buf)
  }
  next()
})

const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: true, credentials: true },
  perMessageDeflate: true
})

const online = new Map()

function isOnline(userId) {
  return (online.get(userId) || 0) > 0
}

function hash(password, salt) {
  return crypto.createHash('sha256').update(salt + password).digest('hex')
}

function hashPassword(password, salt) {
  const N = 16384, r = 8, p = 1
  const h = crypto.scryptSync(String(password), salt, 64, { N, r, p }).toString('hex')
  return ['scrypt', N, r, p, salt, h].join('$')
}

function verifyPassword(user, password) {
  const stored = user.passwordHash || ''
  try {
    if (stored.startsWith('scrypt$')) {
      const parts = stored.split('$') // ['scrypt', N, r, p, salt, hash]
      if (parts.length !== 6) return false
      const [, N, r, p, salt, expected] = parts
      const actual = crypto.scryptSync(String(password), salt, 64, { N: +N, r: +r, p: +p }).toString('hex')
      const a = Buffer.from(actual, 'hex')
      const b = Buffer.from(expected, 'hex')
      return a.length === b.length && crypto.timingSafeEqual(a, b)
    }
    if (stored && user.salt) {
      const a = Buffer.from(stored, 'hex')
      const b = Buffer.from(hash(String(password), user.salt), 'hex')
      return a.length === b.length && crypto.timingSafeEqual(a, b)
    }
  } catch { return false }
  return false
}

// ---------- Two-factor authentication (TOTP, RFC 6238) ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function base32Encode(buf) {
  let bits = 0, value = 0, out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}
function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0, value = 0
  const out = []
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch)
    bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(out)
}
function totpAt(secret, timeStep) {
  const key = base32Decode(secret)
  const counter = Math.floor(timeStep / 30000)
  const msg = Buffer.alloc(8)
  msg.writeUInt32BE(Math.floor(counter / 4294967296), 0)
  msg.writeUInt32BE(counter >>> 0, 4)
  const h = crypto.createHmac('sha1', key).update(msg).digest()
  const off = h[h.length - 1] & 15
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]
  return String(bin % 1000000).padStart(6, '0')
}
function verifyTotp(user, code) {
  const nowMs = Date.now()
  const input = String(code || '').replace(/\s+/g, '')
  for (let w = -1; w <= 1; w++) {
    const ts = nowMs + w * 30000
    const counter = Math.floor(ts / 30000)
    if (user.twoFactorLast && counter <= user.twoFactorLast) continue
    if (totpAt(user.twoFactorSecret, ts) === input) {
      user.twoFactorLast = counter
      return true
    }
  }
  return false
}
const BACKUP_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genBackupCodes(count = 10) {
  const out = []
  while (out.length < count) {
    let s = ''
    for (let i = 0; i < 10; i++) s += BACKUP_CHARS[Math.floor(Math.random() * BACKUP_CHARS.length)]
    out.push(s.slice(0, 5) + '-' + s.slice(5))
  }
  return out
}
function backupHash(code) {
  return crypto.createHash('sha256').update(String(code).toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex')
}
function verifyBackupCode(user, code) {
  const h = backupHash(code)
  const list = user.backupCodes || []
  const i = list.indexOf(h)
  if (i === -1) return false
  list.splice(i, 1)
  if (!list.length) user.backupCodes = null
  return true
}
function otpauthUri(email, secret) {
  return `otpauth://totp/${encodeURIComponent('Underground')}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent('Underground')}`
}
function maskPhone(p) {
  if (!p) return null
  const digits = String(p).replace(/\D/g, '')
  const prefix = String(p).startsWith('+') ? '+' : ''
  if (!digits.length) return prefix
  return `${prefix}••• ••• ${digits.slice(-4)}`
}
function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}
function codeValid(user, kind) {
  const at = kind === 'email' ? user.emailCodeAt : user.phoneCodeAt
  return typeof at === 'number' && Date.now() - at < 10 * 60 * 1000
}
function normalizePhone(input) {
  const s = String(input || '').trim()
  const plus = s.startsWith('+')
  const digits = s.replace(/\D/g, '')
  if (!digits || digits.length < 7 || digits.length > 15) return null
  return (plus ? '+' : '') + digits
}
function selfUser(user) {
  return {
    ...publicUser(user, isOnline(user.id)),
    email: user.email,
    emailVerified: !!user.emailVerified,
    phoneMasked: maskPhone(user.phone),
    phoneVerified: !!user.phoneVerified,
    twoFactorEnabled: !!user.twoFactorEnabled,
    hasPassword: !!user.passwordHash
  }
}
function requireSelfPassword(user, password) {
  return verifyPassword(user, String(password || ''))
}

// Per-account + per-IP login lockout to stop brute force. 5 failures → 5 min lock.
const loginFailures = new Map()
function loginCheck(key) {
  const rec = loginFailures.get(key)
  if (!rec) return { ok: true }
  if (rec.lockUntil && rec.lockUntil > Date.now()) {
    return { ok: false, retryIn: Math.max(1, Math.ceil((rec.lockUntil - Date.now()) / 1000)) }
  }
  if (rec.lockUntil && rec.lockUntil <= Date.now()) {
    loginFailures.delete(key)
    return { ok: true }
  }
  return { ok: true }
}
function loginFail(key) {
  const rec = loginFailures.get(key) || { count: 0 }
  rec.count += 1
  if (rec.count >= 5) {
    rec.lockUntil = Date.now() + 5 * 60 * 1000
    rec.count = 0
  }
  loginFailures.set(key, rec)
}
function loginOk(key) {
  loginFailures.delete(key)
}
function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?'
}

const IMG_RE = /^data:image\/(png|jpe?g|gif|webp);base64,/
const VID_RE = /^data:video\/(mp4|webm);base64,/
const MAX_MEDIA_BYTES = 8 * 1024 * 1024

function isMediaDataUrl(u) {
  return typeof u === 'string' && (IMG_RE.test(u) || VID_RE.test(u))
}

function mediaBytes(dataUrl) {
  const comma = typeof dataUrl === 'string' ? dataUrl.indexOf(',') : -1
  if (comma < 0) return Infinity
  return Math.floor((dataUrl.length - comma - 1) * 3 / 4)
}

function validMedia(dataUrl) {
  return isMediaDataUrl(dataUrl) && mediaBytes(dataUrl) <= MAX_MEDIA_BYTES
}

function publicUser(user, isOnlineFlag, opts) {
  const avatarMedia = user.avatarMedia || null
  const includeMedia = !(opts && opts.light) || !avatarMedia || IMG_RE.test(avatarMedia)
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
    avatarMedia: includeMedia ? avatarMedia : null,
    title: user.title || null,
    badges: user.badges || null,
    online: isOnlineFlag === undefined ? isOnline(user.id) : isOnlineFlag
  }
}

function getUserByToken(req) {
  const store = getStore()
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  const userId = store.sessions[token]
  if (!userId) return null
  return store.users[userId] || null
}

function requireAuth(req, res, next) {
  const user = getUserByToken(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  req.user = user
  next()
}

function serializeMessage(store, msg, channelId) {
  const u = msg.authorId === 'system' ? null : store.users[msg.authorId]
  const author = msg.authorId === 'system'
    ? { id: 'system', username: 'System', color: '#4e5058', system: true }
    : u
      ? publicUser(u, undefined, { light: true })
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
    const t = threadForMessage(store, channelId, msg.id)
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

function threadForMessage(store, channelId, messageId) {
  const threads = store.threads || {}
  for (const t of Object.values(threads)) {
    if (t.channelId === channelId && t.messageId === messageId) return t
  }
  return null
}

function threadSummary(store, t) {
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

function resolveTextTarget(store, id) {
  const ch = store.channels[id]
  if (ch) return ch
  return (store.threads || {})[id] || null
}

function canViewThread(user, t, s) {
  return (t.memberIds || []).includes(user.id) || canManage(user, s)
}

function serverRoles(store, s) {
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

function isMember(store, user, serverId) {
  const s = store.servers[serverId]
  return s && s.memberIds.includes(user.id)
}

function isOwner(user, s) {
  return s.ownerId === user.id
}

function isAdmin(user, s) {
  return !!(s.admins && s.admins.includes(user.id))
}

function canManage(user, s) {
  return isOwner(user, s) || isAdmin(user, s)
}

function deleteUserAccount(store, userId) {
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

function serverSettings(s, viewer) {
  const manage = canManage(viewer, s)
  return {
    description: s.description || '',
    banner: s.banner || null,
    emojis: Object.values(s.emojis || {}),
    isAdmin: isAdmin(viewer, s),
    memberRoles: manage ? { ...(s.memberRoles || {}) } : undefined,
    adminIds: manage ? (s.admins || []) : undefined,
    bans: manage
      ? Object.entries(s.bans || {}).map(([uid, b]) => ({ user: storeUser(uid), reason: b.reason || '', at: b.at })).filter((x) => x.user)
      : undefined,
    invites: manage
      ? Object.entries(getStore().invites || {})
          .filter(([, inv]) => inv.serverId === s.id)
          .map(([code, inv]) => ({ code, createdAt: inv.createdAt, createdBy: inv.createdBy }))
      : undefined
  }
}

function storeUser(id) {
  const u = getStore().users[id]
  return u ? publicUser(u) : null
}

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.post('/api/register', (req, res) => {
  const store = getStore()
  const { username, email, password } = req.body || {}
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email and password are required' })
  }
  if (username.length < 2 || username.length > 32) {
    return res.status(400).json({ error: 'Username must be 2-32 characters' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }
  if (Object.values(store.users).some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'An account with that email already exists' })
  }
  const id = uid('u')
  const salt = crypto.randomBytes(16).toString('hex')
  const colors = ['#5865f2', '#eb459e', '#f0b232', '#23a55a', '#3ba55d', '#ed4245', '#a06cd5', '#00a8fc']
  const color = colors[Object.keys(store.users).length % colors.length]
  store.users[id] = {
    id,
    username,
    email,
    passwordHash: hashPassword(password, salt),
    salt,
    color,
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
    emailPending: null,
    emailCode: null,
    emailCodeAt: null,
    phonePending: null,
    phoneCode: null,
    phoneCodeAt: null,
    createdAt: now()
  }
  const token = uid('t')
  store.sessions[token] = id
  persistNow()
  res.json({ token, user: selfUser(store.users[id]) })
})

app.post('/api/login', (req, res) => {
  const store = getStore()
  const { email, password } = req.body || {}
  const emailKey = String(email || '').toLowerCase().trim()
  const ip = clientIp(req)
  const limEmail = loginCheck('e:' + emailKey)
  const limIp = loginCheck('i:' + ip)
  if (!limEmail.ok || !limIp.ok) {
    const retryIn = Math.max(limEmail.retryIn || 0, limIp.retryIn || 0)
    return res.status(429).json({ error: `Too many login attempts. Try again in ${retryIn} seconds.` })
  }
  const user = Object.values(store.users).find(
    (u) => u.email.toLowerCase() === emailKey
  )
  if (!user || !verifyPassword(user, String(password || ''))) {
    loginFail('e:' + emailKey)
    loginFail('i:' + ip)
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  loginOk('e:' + emailKey)
  loginOk('i:' + ip)
  // Progressive upgrade: rehash legacy sha256 accounts to scrypt on successful login.
  if (!(user.passwordHash || '').startsWith('scrypt$')) {
    const salt = crypto.randomBytes(16).toString('hex')
    user.passwordHash = hashPassword(String(password), salt)
    user.salt = salt
    persistNow()
  }
  if (user.twoFactorEnabled) {
    const tmp = uid('t2')
    store.pending2fa = { token: tmp, userId: user.id, at: Date.now() }
    persistNow()
    return res.json({ needs2fa: true, token: tmp })
  }
  const token = uid('t')
  store.sessions[token] = user.id
  persistNow()
  res.json({ token, user: selfUser(user) })
})

app.post('/api/login/2fa', (req, res) => {
  const store = getStore()
  const { token, code } = req.body || {}
  const pend = store.pending2fa
  if (!pend || pend.token !== token || Date.now() - pend.at > 5 * 60 * 1000) {
    return res.status(401).json({ error: 'Two-factor session expired. Please log in again.' })
  }
  const user = store.users[pend.userId]
  if (!user) return res.status(401).json({ error: 'Invalid two-factor session' })
  const key = '2fa:' + pend.userId
  const lim = loginCheck(key)
  if (!lim.ok) {
    return res.status(429).json({ error: `Too many 2FA attempts. Try again in ${lim.retryIn} seconds.` })
  }
  const okCode = verifyTotp(user, code) || verifyBackupCode(user, code)
  if (!okCode) {
    loginFail(key)
    return res.status(401).json({ error: 'Invalid two-factor code' })
  }
  loginOk(key)
  delete store.pending2fa
  const sess = uid('t')
  store.sessions[sess] = user.id
  persistNow()
  res.json({ token: sess, user: selfUser(user) })
})

app.post('/api/logout', requireAuth, (req, res) => {
  const store = getStore()
  const auth = req.headers.authorization || ''
  const token = auth.slice(7)
  delete store.sessions[token]
  persistNow()
  res.json({ ok: true })
})

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: selfUser(req.user) })
})

app.patch('/api/me', requireAuth, (req, res) => {
  const store = getStore()
  const { username, status, customStatus, color, avatar, gradient, banner, bio, pronoun, profileTheme, decoration, avatarMedia } = req.body || {}
  if (username) {
    if (username.length < 2 || username.length > 32) {
      return res.status(400).json({ error: 'Username must be 2-32 characters' })
    }
    req.user.username = username
  }
  if (['online', 'idle', 'dnd'].includes(status)) {
    req.user.status = status
  }
  if (typeof customStatus === 'string') {
    req.user.customStatus = customStatus.slice(0, 128) || null
  }
  if (color && /^#[0-9a-f]{6}$/i.test(color)) {
    req.user.color = color
  }
  if (typeof avatar === 'string') {
    req.user.avatar = avatar.slice(0, 8) || null
  }
  if (typeof gradient === 'string') {
    req.user.gradient = gradient.slice(0, 32) || null
  }
  if (typeof banner === 'string') {
    req.user.banner = banner.slice(0, 32) || null
  }
  if (typeof bio === 'string') {
    req.user.bio = bio.slice(0, 300) || null
  }
  if (typeof pronoun === 'string') {
    req.user.pronoun = pronoun.slice(0, 32) || null
  }
  if (typeof profileTheme === 'string') {
    req.user.profileTheme = profileTheme.slice(0, 32) || null
  }
  if (typeof decoration === 'string') {
    req.user.decoration = decoration.slice(0, 32) || null
  }
  if (typeof avatarMedia === 'string') {
    if (!validMedia(avatarMedia)) {
      return res.status(400).json({ error: 'Avatar media must be an image or an MP4/WebM clip (max 8 MB)' })
    }
    req.user.avatarMedia = avatarMedia
  } else if (avatarMedia === null) {
    req.user.avatarMedia = null
  }
  persist()
  io.to('presence').emit('presence', {
    userId: req.user.id,
    online: isOnline(req.user.id),
    status: req.user.status,
    customStatus: req.user.customStatus,
    username: req.user.username,
    color: req.user.color,
    avatar: req.user.avatar,
    gradient: req.user.gradient,
    banner: req.user.banner,
    bio: req.user.bio,
    pronoun: req.user.pronoun,
    profileTheme: req.user.profileTheme,
    decoration: req.user.decoration
  })
  res.json({ user: selfUser(req.user) })
})

// ---------- Security & recovery: 2FA, email, phone, password ----------

app.post('/api/2fa/enable', requireAuth, (req, res) => {
  const { password } = req.body || {}
  if (!requireSelfPassword(req.user, password)) return res.status(401).json({ error: 'Incorrect password' })
  if (req.user.twoFactorEnabled) return res.status(400).json({ error: 'Two-factor authentication is already enabled' })
  const secret = base32Encode(crypto.randomBytes(20))
  const plaintext = genBackupCodes()
  req.user.pending2faSecret = secret
  req.user.pending2faCodes = plaintext.map(backupHash)
  req.user.pending2faCodesAt = Date.now()
  persist()
  res.json({ secret, uri: otpauthUri(req.user.email, secret), backupCodes: plaintext })
})

app.post('/api/2fa/confirm', requireAuth, (req, res) => {
  const secret = req.user.pending2faSecret
  if (!secret) return res.status(400).json({ error: 'Start setup first' })
  if (Date.now() - (req.user.pending2faCodesAt || 0) > 10 * 60 * 1000) {
    return res.status(400).json({ error: 'Setup expired. Please start again.' })
  }
  if (!verifyTotp({ twoFactorSecret: secret }, req.body && req.body.code)) {
    return res.status(401).json({ error: 'Invalid code. Check your authenticator app and try again.' })
  }
  req.user.twoFactorEnabled = true
  req.user.twoFactorSecret = secret
  req.user.twoFactorLast = Math.floor(Date.now() / 30000)
  req.user.backupCodes = req.user.pending2faCodes
  delete req.user.pending2faSecret
  delete req.user.pending2faCodes
  delete req.user.pending2faCodesAt
  persist()
  res.json({ user: selfUser(req.user) })
})

app.post('/api/2fa/disable', requireAuth, (req, res) => {
  const { password, code } = req.body || {}
  if (!requireSelfPassword(req.user, password)) return res.status(401).json({ error: 'Incorrect password' })
  if (!req.user.twoFactorEnabled) return res.status(400).json({ error: 'Two-factor authentication is not enabled' })
  if (!(verifyTotp(req.user, code) || verifyBackupCode(req.user, code))) {
    return res.status(401).json({ error: 'Invalid two-factor code' })
  }
  req.user.twoFactorEnabled = false
  req.user.twoFactorSecret = null
  req.user.twoFactorLast = null
  req.user.backupCodes = null
  persist()
  res.json({ user: selfUser(req.user) })
})

app.post('/api/2fa/codes', requireAuth, (req, res) => {
  const { password, code } = req.body || {}
  if (!requireSelfPassword(req.user, password)) return res.status(401).json({ error: 'Incorrect password' })
  if (!req.user.twoFactorEnabled) return res.status(400).json({ error: 'Two-factor authentication is not enabled' })
  if (!(verifyTotp(req.user, code) || verifyBackupCode(req.user, code))) {
    return res.status(401).json({ error: 'Invalid two-factor code' })
  }
  const codes = genBackupCodes()
  req.user.backupCodes = codes.map(backupHash)
  persist()
  res.json({ backupCodes: codes })
})

app.post('/api/me/email/verify-send', requireAuth, (req, res) => {
  req.user.emailCode = genCode()
  req.user.emailCodeAt = Date.now()
  persist()
  res.json({ sent: true, simulatedCode: req.user.emailCode })
})

app.post('/api/me/email/verify', requireAuth, (req, res) => {
  const { code } = req.body || {}
  if (!req.user.emailCode || !codeValid(req.user, 'email') || req.user.emailCode !== String(code).trim()) {
    return res.status(401).json({ error: 'Invalid or expired code' })
  }
  req.user.emailVerified = true
  req.user.emailCode = null
  req.user.emailCodeAt = null
  persist()
  res.json({ user: selfUser(req.user) })
})

app.post('/api/me/email/change', requireAuth, (req, res) => {
  const { newEmail, password } = req.body || {}
  if (!requireSelfPassword(req.user, password)) return res.status(401).json({ error: 'Incorrect password' })
  const email = String(newEmail || '').toLowerCase().trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' })
  if (email === String(req.user.email || '').toLowerCase()) return res.status(400).json({ error: 'That is already your email address' })
  if (Object.values(getStore().users).some((u) => u.id !== req.user.id && String(u.email || '').toLowerCase() === email)) {
    return res.status(409).json({ error: 'An account with that email already exists' })
  }
  req.user.emailPending = email
  req.user.emailCode = genCode()
  req.user.emailCodeAt = Date.now()
  req.user.emailVerified = false
  persist()
  res.json({ sent: true, simulatedCode: req.user.emailCode })
})

app.post('/api/me/email/confirm', requireAuth, (req, res) => {
  const { code } = req.body || {}
  if (!req.user.emailPending) return res.status(400).json({ error: 'No email change pending' })
  if (!req.user.emailCode || !codeValid(req.user, 'email') || req.user.emailCode !== String(code).trim()) {
    return res.status(401).json({ error: 'Invalid or expired code' })
  }
  req.user.email = req.user.emailPending
  req.user.emailPending = null
  req.user.emailCode = null
  req.user.emailCodeAt = null
  req.user.emailVerified = true
  persist()
  res.json({ user: selfUser(req.user) })
})

app.post('/api/me/phone/send', requireAuth, (req, res) => {
  const phone = normalizePhone(req.body && req.body.phone)
  if (!phone) return res.status(400).json({ error: 'Enter a valid phone number (7-15 digits)' })
  if (req.user.phone === phone) return res.status(400).json({ error: 'That is already your phone number' })
  req.user.phonePending = phone
  req.user.phoneCode = genCode()
  req.user.phoneCodeAt = Date.now()
  persist()
  res.json({ sent: true, simulatedCode: req.user.phoneCode, phoneMasked: maskPhone(phone) })
})

app.post('/api/me/phone/verify', requireAuth, (req, res) => {
  const { code } = req.body || {}
  if (!req.user.phonePending) return res.status(400).json({ error: 'No phone number pending' })
  if (!req.user.phoneCode || !codeValid(req.user, 'phone') || req.user.phoneCode !== String(code).trim()) {
    return res.status(401).json({ error: 'Invalid or expired code' })
  }
  req.user.phone = req.user.phonePending
  req.user.phonePending = null
  req.user.phoneCode = null
  req.user.phoneCodeAt = null
  req.user.phoneVerified = true
  persist()
  res.json({ user: selfUser(req.user) })
})

app.post('/api/me/phone/remove', requireAuth, (req, res) => {
  const { password } = req.body || {}
  if (!requireSelfPassword(req.user, password)) return res.status(401).json({ error: 'Incorrect password' })
  if (!req.user.phone) return res.status(400).json({ error: 'No phone number on your account' })
  req.user.phone = null
  req.user.phoneVerified = false
  persist()
  res.json({ user: selfUser(req.user) })
})

app.post('/api/me/password', requireAuth, (req, res) => {
  const { current, next } = req.body || {}
  if (!requireSelfPassword(req.user, current)) return res.status(401).json({ error: 'Current password is incorrect' })
  const pw = String(next || '')
  if (pw.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' })
  const salt = crypto.randomBytes(16).toString('hex')
  req.user.passwordHash = hashPassword(pw, salt)
  req.user.salt = salt
  persist()
  res.json({ ok: true })
})

app.get('/api/servers', requireAuth, (req, res) => {
  const store = getStore()
  const result = Object.values(store.servers)
    .filter((s) => s.memberIds.includes(req.user.id))
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
      const threads = Object.values(store.threads || {})
        .filter((t) => t.serverId === s.id && !t.archived && (canViewThread(req.user, t, s)))
        .map((t) => threadSummary(store, t))
        .sort((a, b) => (b.lastActivityAt || '').localeCompare(a.lastActivityAt || ''))
      return {
        id: s.id,
        name: s.name,
        icon: s.icon,
        iconMedia: s.iconMedia || null,
        description: s.description || '',
        banner: s.banner || null,
        ownerId: s.ownerId,
        isOwner: s.ownerId === req.user.id,
        isAdmin: !!(s.admins && s.admins.includes(req.user.id)),
        channels,
        threads,
        categories: (s.categories || []).map((c) => ({ id: c.id, name: c.name })),
        roles: serverRoles(store, s),
        customRoles: Object.values(s.roles || {}),
        members: s.memberIds.map((mid) => {
          const u = store.users[mid]
          return u ? publicUser(u) : null
        }).filter(Boolean),
        ...serverSettings(s, req.user),
        createdAt: s.createdAt
      }
    })
  res.json(result)
})

app.post('/api/servers', requireAuth, (req, res) => {
  const store = getStore()
  const { name, icon, iconMedia } = req.body || {}
  if (!name || name.length < 2 || name.length > 32) {
    return res.status(400).json({ error: 'Server name must be 2-32 characters' })
  }
  if (iconMedia !== undefined && iconMedia !== null && !validMedia(iconMedia)) {
    return res.status(400).json({ error: 'Server icon must be an image or an MP4/WebM clip (max 8 MB)' })
  }
  const id = uid('s')
  store.servers[id] = {
    id,
    name,
    icon: icon || '🌐',
    iconMedia: iconMedia || null,
    description: '',
    banner: null,
    ownerId: req.user.id,
    memberIds: [req.user.id],
    channelIds: [],
    roles: {},
    memberRoles: {},
    bans: {},
    emojis: {},
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
  store.messages[channelId] = [
    {
      id: uid('m'),
      authorId: 'system',
      content: `Welcome to #${'general'}! You just created **${name}**.`,
      reactions: {},
      createdAt: now()
    }
  ]
  persist()
  io.to('presence').emit('server:created', { serverId: id })
  res.json({ server: { id, name, icon: store.servers[id].icon, iconMedia: store.servers[id].iconMedia, ownerId: req.user.id } })
})

app.post('/api/servers/:id/join', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!s) return res.status(404).json({ error: 'Server not found' })
  if (s.bans && s.bans[req.user.id]) return res.status(403).json({ error: 'You are banned from this server' })
  if (!s.memberIds.includes(req.user.id)) {
    s.memberIds.push(req.user.id)
    persist()
  }
  io.to('presence').emit('server:membership', { serverId: s.id })
  res.json({ ok: true })
})

app.post('/api/servers/:id/leave', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!s) return res.status(404).json({ error: 'Server not found' })
  if (s.ownerId === req.user.id) {
    return res.status(400).json({ error: 'The owner cannot leave their own server' })
  }
  s.memberIds = s.memberIds.filter((id) => id !== req.user.id)
  persist()
  io.to('presence').emit('server:membership', { serverId: s.id })
  res.json({ ok: true })
})

app.post('/api/servers/:id/channels', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!s) return res.status(404).json({ error: 'Server not found' })
  if (!isMember(store, req.user, s.id)) return res.status(403).json({ error: 'Not a member' })
  const { name, type, categoryId } = req.body || {}
  if (!name || !/^[a-z0-9-_ ]+$/i.test(name)) {
    return res.status(400).json({ error: 'Channel names can only use letters, numbers, hyphens and underscores' })
  }
  if (categoryId && !(s.categories || []).some((c) => c.id === categoryId)) {
    return res.status(400).json({ error: 'Category not found' })
  }
  const normalized = name.trim().toLowerCase().replace(/\s+/g, '-')
  const chType = type === 'voice' ? 'voice' : 'text'
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
    store.messages[id] = [
      {
        id: uid('m'),
        authorId: 'system',
        content: `You created #${normalized}. This is the very beginning of #${normalized}.`,
        reactions: {},
        createdAt: now()
      }
    ]
  }
  persist()
  io.to('presence').emit('server:membership', { serverId: s.id })
  res.json({ channel: store.channels[id] })
})

app.get('/api/channels/:id/threads', requireAuth, (req, res) => {
  const store = getStore()
  const ch = store.channels[req.params.id]
  if (!ch) return res.status(404).json({ error: 'Channel not found' })
  if (!isMember(store, req.user, ch.serverId)) return res.status(403).json({ error: 'Not a member' })
  const includeArchived = req.query.archived === '1'
  const s = store.servers[ch.serverId]
  const list = Object.values(store.threads || {})
    .filter((t) => t.channelId === ch.id)
    .filter((t) => includeArchived || !t.archived)
    .filter((t) => canViewThread(req.user, t, s))
    .map((t) => threadSummary(store, t))
    .sort((a, b) => (b.lastActivityAt || '').localeCompare(a.lastActivityAt || ''))
  res.json({ threads: list })
})

app.post('/api/channels/:id/threads', requireAuth, (req, res) => {
  const store = getStore()
  const ch = store.channels[req.params.id]
  if (!ch) return res.status(404).json({ error: 'Channel not found' })
  if (ch.type !== 'text') return res.status(400).json({ error: 'Threads can only be created in text channels' })
  if (!isMember(store, req.user, ch.serverId)) return res.status(403).json({ error: 'Not a member' })
  const name = String((req.body && req.body.name) || '').trim()
  if (name.length < 2 || name.length > 60) {
    return res.status(400).json({ error: 'Thread name must be 2-60 characters' })
  }
  const messageId = req.body && req.body.messageId
  if (messageId && !(store.messages[ch.id] || []).some((m) => m.id === messageId)) {
    return res.status(404).json({ error: 'Message not found' })
  }
  const id = uid('t')
  const t = {
    id,
    serverId: ch.serverId,
    channelId: ch.id,
    messageId: messageId || null,
    ownerId: req.user.id,
    name,
    memberIds: [req.user.id],
    archived: false,
    createdAt: now(),
    lastActivityAt: now()
  }
  store.threads = store.threads || {}
  store.threads[id] = t
  store.messages[id] = [
    {
      id: uid('m'),
      authorId: 'system',
      content: `Thread started: **${name}**`,
      reactions: {},
      createdAt: now()
    }
  ]
  persist()
  io.to('presence').emit('thread:update', { serverId: ch.serverId, threadId: id })
  res.json({ thread: threadSummary(store, t) })
})

app.post('/api/threads/:id/join', requireAuth, (req, res) => {
  const store = getStore()
  const t = (store.threads || {})[req.params.id]
  if (!t) return res.status(404).json({ error: 'Thread not found' })
  if (!isMember(store, req.user, t.serverId)) return res.status(403).json({ error: 'Not a member' })
  if (t.archived) return res.status(400).json({ error: 'Thread is archived' })
  if (!t.memberIds.includes(req.user.id)) {
    t.memberIds.push(req.user.id)
    persist()
  }
  io.to('presence').emit('thread:update', { serverId: t.serverId, threadId: t.id })
  res.json({ thread: threadSummary(store, t) })
})

app.post('/api/threads/:id/leave', requireAuth, (req, res) => {
  const store = getStore()
  const t = (store.threads || {})[req.params.id]
  if (!t) return res.status(404).json({ error: 'Thread not found' })
  t.memberIds = (t.memberIds || []).filter((id) => id !== req.user.id)
  persist()
  io.to('presence').emit('thread:update', { serverId: t.serverId, threadId: t.id })
  res.json({ ok: true })
})

app.patch('/api/threads/:id', requireAuth, (req, res) => {
  const store = getStore()
  const t = (store.threads || {})[req.params.id]
  if (!t) return res.status(404).json({ error: 'Thread not found' })
  const s = store.servers[t.serverId]
  if (!isMember(store, req.user, t.serverId)) return res.status(403).json({ error: 'Not a member' })
  const { name, archived } = req.body || {}
  if (name !== undefined) {
    const n = String(name).trim()
    if (n.length < 2 || n.length > 60) return res.status(400).json({ error: 'Thread name must be 2-60 characters' })
    if (!canViewThread(req.user, t, s)) return res.status(403).json({ error: 'You are not in this thread' })
    t.name = n
  }
  if (archived !== undefined) {
    if (t.ownerId !== req.user.id && !canManage(req.user, s)) {
      return res.status(403).json({ error: 'Only the thread owner or an admin can archive this thread' })
    }
    t.archived = !!archived
  }
  persist()
  io.to('presence').emit('thread:update', { serverId: t.serverId, threadId: t.id })
  res.json({ thread: threadSummary(store, t) })
})

app.delete('/api/threads/:id', requireAuth, (req, res) => {
  const store = getStore()
  const t = (store.threads || {})[req.params.id]
  if (!t) return res.status(404).json({ error: 'Thread not found' })
  const s = store.servers[t.serverId]
  if (t.ownerId !== req.user.id && !canManage(req.user, s)) {
    return res.status(403).json({ error: 'Only the thread owner or an admin can delete this thread' })
  }
  delete store.threads[t.id]
  delete store.messages[t.id]
  persist()
  io.to('presence').emit('thread:update', { serverId: t.serverId, threadId: t.id })
  res.json({ ok: true })
})

app.get('/api/channels/:id/messages', requireAuth, (req, res) => {
  const store = getStore()
  const ch = resolveTextTarget(store, req.params.id)
  if (!ch) return res.status(404).json({ error: 'Channel not found' })
  if (!isMember(store, req.user, ch.serverId)) return res.status(403).json({ error: 'Not a member' })
  if (!store.channels[req.params.id] && !canViewThread(req.user, ch, store.servers[ch.serverId])) {
    return res.status(403).json({ error: 'You are not in this thread' })
  }
  const msgs = store.messages[ch.id] || []
  const limit = Math.min(parseInt(req.query.limit) || 100, 200)
  const before = req.query.before
  let slice = msgs
  if (before) {
    const idx = msgs.findIndex((m) => m.id === before)
    if (idx !== -1) slice = msgs.slice(0, idx)
  }
  const page = slice.slice(-limit)
  res.json({ messages: page.map((m) => serializeMessage(store, m, req.params.id)), hasMore: slice.length > limit })
})

app.get('/api/dms', requireAuth, (req, res) => {
  const store = getStore()
  const result = Object.values(store.dms)
    .filter((d) => d.memberIds.includes(req.user.id))
    .map((d) => {
      const otherId = d.memberIds.find((id) => id !== req.user.id)
      const other = store.users[otherId]
      const msgs = store.dmMessages[d.id] || []
      const last = msgs[msgs.length - 1]
      return {
        id: d.id,
        recipient: other ? publicUser(other) : null,
        lastMessageAt: last ? last.createdAt : null
      }
    })
    .filter((d) => d.recipient)
    .sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''))
  res.json(result)
})

app.post('/api/dms', requireAuth, (req, res) => {
  const store = getStore()
  const { userId } = req.body || {}
  const other = store.users[userId]
  if (!other) return res.status(404).json({ error: 'User not found' })
  if (userId === req.user.id) return res.status(400).json({ error: 'You cannot DM yourself' })
  const existing = Object.values(store.dms).find(
    (d) => d.memberIds.includes(req.user.id) && d.memberIds.includes(userId)
  )
  if (existing) {
    return res.json({ id: existing.id, recipient: publicUser(other) })
  }
  const id = uid('d')
  store.dms[id] = { id, memberIds: [req.user.id, userId], createdAt: now() }
  store.dmMessages[id] = []
  persist()
  res.json({ id, recipient: publicUser(other) })
})

app.get('/api/dm/:id/messages', requireAuth, (req, res) => {
  const store = getStore()
  const dm = store.dms[req.params.id]
  if (!dm) return res.status(404).json({ error: 'DM not found' })
  if (!dm.memberIds.includes(req.user.id)) return res.status(403).json({ error: 'Not a member' })
  const msgs = store.dmMessages[dm.id] || []
  const limit = Math.min(parseInt(req.query.limit) || 100, 200)
  const before = req.query.before
  let slice = msgs
  if (before) {
    const idx = msgs.findIndex((m) => m.id === before)
    if (idx !== -1) slice = msgs.slice(0, idx)
  }
  const page = slice.slice(-limit)
  res.json({ messages: page.map((m) => serializeMessage(store, m)), hasMore: slice.length > limit })
})

app.get('/api/users', requireAuth, (req, res) => {
  const store = getStore()
  const q = String(req.query.query || '').toLowerCase()
  const list = Object.values(store.users)
    .filter((u) => u.id !== req.user.id)
    .filter((u) => !q || u.username.toLowerCase().includes(q))
    .slice(0, 20)
  res.json(list.map((u) => publicUser(u)))
})

app.get('/api/friends', requireAuth, (req, res) => {
  const store = getStore()
  const list = (store.friendships || []).filter(
    (f) => f.requester === req.user.id || f.target === req.user.id
  )
  const incoming = list
    .filter((f) => f.status === 'pending' && f.target === req.user.id)
    .map((f) => ({ id: f.id, user: publicUser(store.users[f.requester]) }))
  const outgoing = list
    .filter((f) => f.status === 'pending' && f.requester === req.user.id)
    .map((f) => ({ id: f.id, user: publicUser(store.users[f.target]) }))
  const friends = list
    .filter((f) => f.status === 'accepted')
    .map((f) => {
      const otherId = f.requester === req.user.id ? f.target : f.requester
      return publicUser(store.users[otherId])
    })
    .filter((u) => u)
    .sort((a, b) => (b.online === a.online ? a.username.localeCompare(b.username) : b.online ? 1 : -1))
  res.json({ incoming, outgoing, friends })
})

app.post('/api/friends/request', requireAuth, (req, res) => {
  const store = getStore()
  const { email, userId } = req.body || {}
  let target = null
  if (userId) target = store.users[userId]
  else {
    target = Object.values(store.users).find(
      (u) => u.email.toLowerCase() === String(email || '').toLowerCase()
    )
  }
  if (!target) return res.status(404).json({ error: 'No user found with that email' })
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot add yourself' })
  store.friendships = store.friendships || []
  const existing = store.friendships.find(
    (f) =>
      (f.requester === req.user.id && f.target === target.id) ||
      (f.requester === target.id && f.target === req.user.id)
  )
  if (existing) {
    return res.status(409).json({ error: existing.status === 'pending' ? 'Request already sent' : 'Already friends' })
  }
  const fs = { id: uid('f'), requester: req.user.id, target: target.id, status: 'pending', createdAt: now() }
  store.friendships.push(fs)
  persist()
  io.to(`user:${target.id}`).emit('friendship:update')
  io.to(`user:${req.user.id}`).emit('friendship:update')
  res.json({ ok: true, id: fs.id })
})

app.post('/api/friends/:id/accept', requireAuth, (req, res) => {
  const store = getStore()
  const f = (store.friendships || []).find((x) => x.id === req.params.id)
  if (!f || f.status !== 'pending' || f.target !== req.user.id) {
    return res.status(404).json({ error: 'Request not found' })
  }
  f.status = 'accepted'
  persist()
  io.to(`user:${f.requester}`).emit('friendship:update')
  io.to(`user:${f.target}`).emit('friendship:update')
  res.json({ ok: true })
})

app.post('/api/friends/:id/decline', requireAuth, (req, res) => {
  const store = getStore()
  const list = store.friendships || []
  const idx = list.findIndex((x) => x.id === req.params.id)
  if (idx === -1 || list[idx].target !== req.user.id) {
    return res.status(404).json({ error: 'Request not found' })
  }
  list.splice(idx, 1)
  persist()
  io.to(`user:${req.user.id}`).emit('friendship:update')
  res.json({ ok: true })
})

app.post('/api/friends/:id/remove', requireAuth, (req, res) => {
  const store = getStore()
  const list = store.friendships || []
  const idx = list.findIndex((x) => x.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  const f = list[idx]
  if (f.requester !== req.user.id && f.target !== req.user.id) {
    return res.status(403).json({ error: 'Not allowed' })
  }
  list.splice(idx, 1)
  persist()
  io.to(`user:${f.requester}`).emit('friendship:update')
  io.to(`user:${f.target}`).emit('friendship:update')
  res.json({ ok: true })
})

app.get('/api/channels/:id/pins', requireAuth, (req, res) => {
  const store = getStore()
  const ch = resolveTextTarget(store, req.params.id)
  if (!ch) return res.status(404).json({ error: 'Channel not found' })
  if (!isMember(store, req.user, ch.serverId)) return res.status(403).json({ error: 'Not a member' })
  if (!store.channels[req.params.id] && !canViewThread(req.user, ch, store.servers[ch.serverId])) {
    return res.status(403).json({ error: 'You are not in this thread' })
  }
  const msgs = store.messages[ch.id] || []
  const pins = msgs.filter((m) => m.pinned)
  res.json({ messages: pins.map((m) => serializeMessage(store, m, req.params.id)) })
})

app.get('/api/channels/:id/search', requireAuth, (req, res) => {
  const store = getStore()
  const ch = resolveTextTarget(store, req.params.id)
  if (!ch) return res.status(404).json({ error: 'Channel not found' })
  if (!isMember(store, req.user, ch.serverId)) return res.status(403).json({ error: 'Not a member' })
  if (!store.channels[req.params.id] && !canViewThread(req.user, ch, store.servers[ch.serverId])) {
    return res.status(403).json({ error: 'You are not in this thread' })
  }
  const q = String(req.query.q || '').toLowerCase()
  const authorId = req.query.author
  const msgs = (store.messages[ch.id] || []).filter((m) => {
    if (authorId && m.authorId !== authorId) return false
    if (q && !m.content.toLowerCase().includes(q)) return false
    return true
  })
  res.json({ messages: msgs.slice(-50).map((m) => serializeMessage(store, m, req.params.id)) })
})

app.get('/api/inbox', requireAuth, (req, res) => {
  const store = getStore()
  const me = req.user
  const out = []
  const pushTarget = (list, target) => {
    for (const m of list) {
      if (m.authorId === 'system' || m.authorId === me.id) continue
      const content = m.content || ''
      const isMention = content.includes(`@${me.username}`) || content.includes('@everyone') || content.includes('@here')
      const isReply = !!(m.replyTo && m.replyTo.authorId === me.id)
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
    if (!s.memberIds.includes(me.id)) continue
    for (const chId of s.channelIds) {
      const ch = store.channels[chId]
      if (ch && ch.type === 'text') {
        pushTarget(store.messages[chId] || [], { type: 'channel', id: chId, serverId: s.id })
      }
    }
    for (const t of Object.values(store.threads || {})) {
      if (t.serverId !== s.id || t.archived) continue
      if (!canViewThread(me, t, s)) continue
      pushTarget(store.messages[t.id] || [], { type: 'channel', id: t.id, serverId: s.id })
    }
  }
  for (const d of Object.values(store.dms)) {
    if (!d.memberIds.includes(me.id)) continue
    pushTarget(store.dmMessages[d.id] || [], { type: 'dm', id: d.id })
  }
  out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  res.json({ notifications: out.slice(0, 50) })
})

app.post('/api/servers/:id/invite', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!s) return res.status(404).json({ error: 'Server not found' })
  if (!isMember(store, req.user, s.id)) return res.status(403).json({ error: 'Not a member' })
  const code = crypto.randomBytes(4).toString('hex')
  store.invites = store.invites || {}
  store.invites[code] = { serverId: s.id, createdBy: req.user.id, createdAt: now() }
  persist()
  res.json({ code, serverId: s.id, serverName: s.name, icon: s.icon })
})

app.get('/api/invites/:code', (req, res) => {
  const store = getStore()
  const inv = (store.invites || {})[req.params.code]
  if (!inv) return res.status(404).json({ error: 'Invite not found or expired' })
  const s = store.servers[inv.serverId]
  if (!s) return res.status(404).json({ error: 'Server not found or expired' })
  res.json({ code: req.params.code, serverId: s.id, serverName: s.name, icon: s.icon, members: s.memberIds.length })
})

app.post('/api/invites/:code/join', requireAuth, (req, res) => {
  const store = getStore()
  const inv = (store.invites || {})[req.params.code]
  if (!inv) return res.status(404).json({ error: 'Invite not found or expired' })
  const s = store.servers[inv.serverId]
  if (!s) return res.status(404).json({ error: 'Server not found or expired' })
  if (s.bans && s.bans[req.user.id]) return res.status(403).json({ error: 'You are banned from this server' })
  if (!s.memberIds.includes(req.user.id)) {
    s.memberIds.push(req.user.id)
    persist()
  }
  io.to('presence').emit('server:membership', { serverId: s.id })
  io.to(`user:${req.user.id}`).emit('server:joined')
  res.json({ serverId: s.id })
})

function getServerOr404(res, s) {
  if (!s) {
    res.status(404).json({ error: 'Server not found' })
    return false
  }
  return true
}

// ---- Server settings (owner / admin) -----------------------------------

const ROLE_NAME_RE = /^[\w \-]{2,32}$/
const EMOJI_NAME_RE = /^[a-zA-Z0-9_+]{2,6}$/

app.patch('/api/servers/:id', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!isMember(store, req.user, s.id)) return res.status(403).json({ error: 'Not a member' })
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can edit server settings' })
  const { name, description, banner, icon, iconMedia } = req.body || {}
  if (name !== undefined) {
    if (name.length < 2 || name.length > 32) return res.status(400).json({ error: 'Server name must be 2-32 characters' })
    s.name = name
  }
  if (typeof description === 'string') s.description = description.slice(0, 300)
  if (typeof banner === 'string') s.banner = banner.slice(0, 32) || null
  if (typeof icon === 'string') s.icon = icon.slice(0, 8) || '🌐'
  if (iconMedia !== undefined) {
    if (iconMedia !== null && !validMedia(iconMedia)) {
      return res.status(400).json({ error: 'Server icon must be an image or an MP4/WebM clip (max 8 MB)' })
    }
    s.iconMedia = iconMedia
  }
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  res.json({ server: { id: s.id, name: s.name, icon: s.icon, iconMedia: s.iconMedia, description: s.description, banner: s.banner, ownerId: s.ownerId } })
})

app.delete('/api/servers/:id', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!isOwner(req.user, s)) return res.status(403).json({ error: 'Only the owner can delete this server' })
  for (const cid of s.channelIds) {
    delete store.channels[cid]
    delete store.messages[cid]
  }
  for (const [code, inv] of Object.entries(store.invites || {})) {
    if (inv.serverId === s.id) delete store.invites[code]
  }
  delete store.servers[s.id]
  persist()
  io.to('presence').emit('server:deleted', { serverId: s.id })
  res.json({ ok: true })
})

// ---- Roles ---------------------------------------------------------------

app.get('/api/servers/:id/roles', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!isMember(store, req.user, s.id)) return res.status(403).json({ error: 'Not a member' })
  res.json({ roles: Object.values(s.roles || {}) })
})

app.post('/api/servers/:id/roles', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can manage roles' })
  const { name, color } = req.body || {}
  if (!ROLE_NAME_RE.test(String(name || ''))) return res.status(400).json({ error: 'Role name must be 2-32 characters' })
  if (color && !/^#[0-9a-f]{6}$/i.test(color)) return res.status(400).json({ error: 'Invalid role color' })
  const rid = uid('r')
  s.roles = s.roles || {}
  s.roles[rid] = { id: rid, name: name.trim(), color: color || '#5865f2' }
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  res.json({ role: s.roles[rid] })
})

app.patch('/api/servers/:id/roles/:rid', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can manage roles' })
  const role = s.roles && s.roles[req.params.rid]
  if (!role) return res.status(404).json({ error: 'Role not found' })
  const { name, color } = req.body || {}
  if (name !== undefined && !ROLE_NAME_RE.test(String(name))) return res.status(400).json({ error: 'Role name must be 2-32 characters' })
  if (color !== undefined && !/^#[0-9a-f]{6}$/i.test(color)) return res.status(400).json({ error: 'Invalid role color' })
  if (name !== undefined) role.name = name.trim()
  if (color !== undefined) role.color = color
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  res.json({ role })
})

app.delete('/api/servers/:id/roles/:rid', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can manage roles' })
  if (!s.roles || !s.roles[req.params.rid]) return res.status(404).json({ error: 'Role not found' })
  delete s.roles[req.params.rid]
  for (const mid of Object.keys(s.memberRoles || {})) {
    if (s.memberRoles[mid] === req.params.rid) delete s.memberRoles[mid]
  }
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  res.json({ ok: true })
})

// ---- Members ---------------------------------------------------------------

app.patch('/api/servers/:id/members/:uid/role', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can manage members' })
  const uid = req.params.uid
  if (!s.memberIds.includes(uid)) return res.status(404).json({ error: 'Member not found' })
  if (uid === s.ownerId) return res.status(400).json({ error: 'You cannot change the owner role' })
  const { roleId } = req.body || {}
  s.memberRoles = s.memberRoles || {}
  if (roleId === null || roleId === undefined) delete s.memberRoles[uid]
  else if (s.roles && s.roles[roleId]) s.memberRoles[uid] = roleId
  else return res.status(400).json({ error: 'Role not found' })
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  io.to(`user:${uid}`).emit('server:updated', { serverId: s.id })
  res.json({ ok: true })
})

app.post('/api/servers/:id/members/:uid/kick', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can kick members' })
  const uid = req.params.uid
  if (uid === s.ownerId) return res.status(400).json({ error: 'You cannot kick the owner' })
  if (uid === req.user.id && !isOwner(req.user, s)) return res.status(400).json({ error: 'Admins cannot kick themselves; use Leave Server instead' })
  if (!s.memberIds.includes(uid)) return res.status(404).json({ error: 'Member not found' })
  s.memberIds = s.memberIds.filter((id) => id !== uid)
  if (s.memberRoles) delete s.memberRoles[uid]
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  io.to(`user:${uid}`).emit('server:kicked', { serverId: s.id })
  res.json({ ok: true })
})

app.post('/api/servers/:id/members/:uid/admin', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!isOwner(req.user, s)) return res.status(403).json({ error: 'Only the owner can manage admins' })
  const uid = req.params.uid
  if (uid === s.ownerId) return res.status(400).json({ error: 'The owner is always an owner' })
  if (!s.memberIds.includes(uid)) return res.status(404).json({ error: 'Member not found' })
  const { admin } = req.body || {}
  s.admins = s.admins || []
  if (admin) {
    if (!s.admins.includes(uid)) s.admins.push(uid)
  } else {
    s.admins = s.admins.filter((id) => id !== uid)
  }
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  io.to(`user:${uid}`).emit('server:updated', { serverId: s.id })
  res.json({ ok: true })
})

app.post('/api/servers/:id/members/:uid/delete-account', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!isOwner(req.user, s)) return res.status(403).json({ error: 'Only the server owner can delete accounts' })
  const uid = req.params.uid
  if (uid === s.ownerId) return res.status(400).json({ error: 'You cannot delete the owner account' })
  if (!s.memberIds.includes(uid)) return res.status(404).json({ error: 'Member not found' })
  if (!store.users[uid]) return res.status(404).json({ error: 'Account not found' })
  deleteUserAccount(store, uid)
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  io.to(`user:${uid}`).emit('server:kicked', { serverId: s.id, banned: true })
  io.to('presence').emit('presence', { userId: uid, online: false })
  res.json({ ok: true })
})

// ---- Channels ---------------------------------------------------------------

app.patch('/api/servers/:id/channels/:cid', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can manage channels' })
  const ch = store.channels[req.params.cid]
  if (!ch || ch.serverId !== s.id) return res.status(404).json({ error: 'Channel not found' })
  const { name, topic, categoryId } = req.body || {}
  if (name !== undefined) {
    if (!name || !/^[a-z0-9-_ ]+$/i.test(name)) {
      return res.status(400).json({ error: 'Channel names can only use letters, numbers, hyphens and underscores' })
    }
    ch.name = name.trim().toLowerCase().replace(/\s+/g, '-')
  }
  if (typeof topic === 'string') ch.topic = topic.slice(0, 200)
  if (categoryId !== undefined) {
    if (categoryId !== null && !(s.categories || []).some((c) => c.id === categoryId)) {
      return res.status(400).json({ error: 'Category not found' })
    }
    ch.categoryId = categoryId || null
  }
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  res.json({ channel: { id: ch.id, name: ch.name, topic: ch.topic, type: ch.type, categoryId: ch.categoryId } })
})

app.post('/api/servers/:id/channels/reorder', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can reorder channels' })
  const { orderedIds } = req.body || {}
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds is required' })
  const valid = new Set(s.channelIds)
  if (orderedIds.some((id) => !valid.has(id)) || orderedIds.length !== s.channelIds.length) {
    return res.status(400).json({ error: 'Invalid channel list' })
  }
  s.channelIds = orderedIds
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  res.json({ ok: true })
})

// ---- Categories --------------------------------------------------------------

app.post('/api/servers/:id/categories', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can manage categories' })
  const name = String((req.body && req.body.name) || '').trim()
  if (!name || name.length > 32) return res.status(400).json({ error: 'Category name must be 1-32 characters' })
  s.categories = s.categories || []
  const cat = { id: uid('cat'), name }
  s.categories.push(cat)
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  res.json({ category: cat })
})

app.patch('/api/servers/:id/categories/:catId', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can manage categories' })
  const cat = (s.categories || []).find((c) => c.id === req.params.catId)
  if (!cat) return res.status(404).json({ error: 'Category not found' })
  const name = String((req.body && req.body.name) || '').trim()
  if (!name || name.length > 32) return res.status(400).json({ error: 'Category name must be 1-32 characters' })
  cat.name = name
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  res.json({ category: cat })
})

app.delete('/api/servers/:id/categories/:catId', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can manage categories' })
  const before = (s.categories || []).length
  s.categories = (s.categories || []).filter((c) => c.id !== req.params.catId)
  if (s.categories.length === before) return res.status(404).json({ error: 'Category not found' })
  for (const cid of s.channelIds) {
    const ch = store.channels[cid]
    if (ch && ch.categoryId === req.params.catId) ch.categoryId = null
  }
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  res.json({ ok: true })
})

app.post('/api/servers/:id/categories/reorder', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can reorder categories' })
  const { orderedIds } = req.body || {}
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds is required' })
  const cats = s.categories || []
  if (orderedIds.length !== cats.length || orderedIds.some((id) => !cats.some((c) => c.id === id))) {
    return res.status(400).json({ error: 'Invalid category list' })
  }
  s.categories = orderedIds.map((id) => cats.find((c) => c.id === id))
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  res.json({ ok: true })
})

app.delete('/api/servers/:id/channels/:cid', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can manage channels' })
  const ch = store.channels[req.params.cid]
  if (!ch || ch.serverId !== s.id) return res.status(404).json({ error: 'Channel not found' })
  s.channelIds = s.channelIds.filter((id) => id !== ch.id)
  delete store.channels[ch.id]
  delete store.messages[ch.id]
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  res.json({ ok: true })
})

app.post('/api/servers/:id/channels/:cid/move', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can manage channels' })
  const ch = store.channels[req.params.cid]
  if (!ch || ch.serverId !== s.id) return res.status(404).json({ error: 'Channel not found' })
  const { dir } = req.body || {}
  const idx = s.channelIds.indexOf(ch.id)
  if (dir === 'up' && idx > 0) {
    s.channelIds.splice(idx, 1)
    s.channelIds.splice(idx - 1, 0, ch.id)
  } else if (dir === 'down' && idx < s.channelIds.length - 1) {
    s.channelIds.splice(idx, 1)
    s.channelIds.splice(idx + 1, 0, ch.id)
  }
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  res.json({ ok: true })
})

// ---- Invites ---------------------------------------------------------------

app.get('/api/servers/:id/invites', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can view invites' })
  const list = Object.entries(store.invites || {})
    .filter(([, inv]) => inv.serverId === s.id)
    .map(([code, inv]) => ({ code, createdAt: inv.createdAt, createdBy: inv.createdBy }))
  res.json({ invites: list })
})

app.delete('/api/servers/:id/invites/:code', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can manage invites' })
  const inv = (store.invites || {})[req.params.code]
  if (!inv || inv.serverId !== s.id) return res.status(404).json({ error: 'Invite not found' })
  delete store.invites[req.params.code]
  persist()
  res.json({ ok: true })
})

// ---- Custom emoji -----------------------------------------------------------

app.post('/api/servers/:id/emoji', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can manage emoji' })
  const { name, emoji, media } = req.body || {}
  const n = String(name || '').trim()
  if (!EMOJI_NAME_RE.test(n)) return res.status(400).json({ error: 'Emoji name must be 2-6 letters, numbers, _ or +' })
  if (media !== undefined && media !== null && !validMedia(media)) {
    return res.status(400).json({ error: 'Custom emoji media must be an image or a short clip (max 8 MB)' })
  }
  if (!emoji && !media) return res.status(400).json({ error: 'Provide an emoji or an image/clip' })
  if (emoji && String(emoji).length > 8) return res.status(400).json({ error: 'Emoji too long' })
  s.emojis = s.emojis || {}
  const eid = uid('e')
  s.emojis[eid] = { id: eid, name: n, emoji: emoji ? String(emoji) : null, media: media || null }
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  res.json({ emoji: s.emojis[eid] })
})

app.delete('/api/servers/:id/emoji/:eid', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can manage emoji' })
  if (!s.emojis || !s.emojis[req.params.eid]) return res.status(404).json({ error: 'Emoji not found' })
  delete s.emojis[req.params.eid]
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  res.json({ ok: true })
})

// ---- Bans -------------------------------------------------------------------

app.post('/api/servers/:id/bans', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can ban members' })
  const uid = req.params.uid || (req.body && req.body.userId)
  if (!uid || !store.users[uid]) return res.status(404).json({ error: 'User not found' })
  if (uid === s.ownerId) return res.status(400).json({ error: 'You cannot ban the owner' })
  const reason = String((req.body && req.body.reason) || '').slice(0, 200)
  s.bans = s.bans || {}
  s.bans[uid] = { reason, at: now() }
  if (s.memberIds.includes(uid)) {
    s.memberIds = s.memberIds.filter((id) => id !== uid)
    if (s.memberRoles) delete s.memberRoles[uid]
    if (s.admins) s.admins = s.admins.filter((id) => id !== uid)
  }
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  io.to(`user:${uid}`).emit('server:kicked', { serverId: s.id, banned: true })
  res.json({ ok: true })
})

app.get('/api/servers/:id/bans', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can view bans' })
  const list = Object.entries(s.bans || {})
    .map(([bid, b]) => ({ user: storeUser(bid), reason: b.reason || '', at: b.at }))
    .filter((x) => x.user)
  res.json({ bans: list })
})

app.delete('/api/servers/:id/bans/:uid', requireAuth, (req, res) => {
  const store = getStore()
  const s = store.servers[req.params.id]
  if (!getServerOr404(res, s)) return
  if (!canManage(req.user, s)) return res.status(403).json({ error: 'Only the owner or admins can manage bans' })
  if (!s.bans || !s.bans[req.params.uid]) return res.status(404).json({ error: 'Ban not found' })
  delete s.bans[req.params.uid]
  persist()
  io.to('presence').emit('server:updated', { serverId: s.id })
  res.json({ ok: true })
})

function getTarget(store, user, target) {
  if (target.type === 'channel') {
    const ch = store.channels[target.id]
    if (ch) {
      if (!isMember(store, user, ch.serverId)) return null
      return { storeKey: 'messages', list: store.messages[ch.id] || (store.messages[ch.id] = []) }
    }
    const t = (store.threads || {})[target.id]
    if (t) {
      if (!isMember(store, user, t.serverId)) return null
      if (!canViewThread(user, t, store.servers[t.serverId])) return null
      return { storeKey: 'messages', list: store.messages[t.id] || (store.messages[t.id] = []), thread: t }
    }
    return null
  }
  if (target.type === 'dm') {
    const dm = store.dms[target.id]
    if (!dm || !dm.memberIds.includes(user.id)) return null
    return { storeKey: 'dmMessages', list: store.dmMessages[dm.id] || (store.dmMessages[dm.id] = []) }
  }
  return null
}

function roomFor(target) {
  return target.type === 'channel' ? `ch:${target.id}` : `dm:${target.id}`
}

function canCallUsers(store, a, b) {
  const shareDm = Object.values(store.dms || {}).some((d) => (d.memberIds || []).includes(a) && (d.memberIds || []).includes(b))
  const friends = (store.friendships || []).some(
    (f) =>
      f.status === 'accepted' &&
      ((f.requester === a && f.target === b) || (f.requester === b && f.target === a))
  )
  return shareDm || friends
}

const voiceRooms = new Map()

function voiceStateFor(serverId) {
  const store = getStore()
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
  io.to('presence').emit('voice:state', { serverId, channels: voiceStateFor(serverId) })
}

io.use((socket, next) => {
  const store = getStore()
  const token = socket.handshake.auth && socket.handshake.auth.token
  if (!token) return next(new Error('Not authenticated'))
  const userId = store.sessions[token]
  if (!userId) return next(new Error('Not authenticated'))
  socket.userId = userId
  next()
})

io.on('connection', (socket) => {
  const store = getStore()
  const user = store.users[socket.userId]
  if (!user) return socket.disconnect(true)

  const wasOffline = !isOnline(user.id)
  online.set(user.id, (online.get(user.id) || 0) + 1)
  socket.join('presence')
  socket.join(`user:${user.id}`)
  socket.data.typing = new Map()
  socket.data.lastMessageAt = 0

  if (wasOffline) {
    io.to('presence').emit('presence', { userId: user.id, online: true, status: user.status })
  }

  socket.on('chat:send', (payload, ack) => {
    const nowMs = Date.now()
    if (nowMs - socket.data.lastMessageAt < 400) {
      return ack && ack({ error: 'You are sending messages too fast' })
    }
    socket.data.lastMessageAt = nowMs
    const content = String((payload && payload.content) || '').slice(0, 2000)
    const attachment = payload && payload.attachment
    const sticker = payload && payload.sticker
    if (!content.trim() && !attachment && !sticker) return ack && ack({ error: 'Message is empty' })
    const target = getTarget(store, user, payload && payload.target)
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
      target.thread.lastActivityAt = msg.createdAt
      if (!target.thread.memberIds.includes(user.id)) target.thread.memberIds.push(user.id)
      io.to('presence').emit('thread:update', { serverId: target.thread.serverId, threadId: target.thread.id })
    }
    persist()

    const serialized = serializeMessage(store, msg, payload.target.type === 'channel' ? payload.target.id : null)
    serialized.target = payload.target
    socket.to(roomFor(payload.target)).emit('chat:message', serialized)
    socket.emit('chat:ack', { nonce: payload.nonce, target: payload.target, message: serialized })
    ack && ack({ message: serialized })
  })

  socket.on('chat:edit', (payload, ack) => {
    const target = getTarget(store, user, payload && payload.target)
    if (!target) return ack && ack({ error: 'Invalid target' })
    const msg = target.list.find((m) => m.id === payload.messageId)
    if (!msg) return ack && ack({ error: 'Message not found' })
    if (msg.authorId !== user.id) return ack && ack({ error: 'You can only edit your own messages' })
    msg.content = String(payload.content || '').slice(0, 2000)
    msg.edited = true
    persist()
    io.to(roomFor(payload.target)).emit('chat:edit', {
      target: payload.target,
      messageId: msg.id,
      content: msg.content,
      edited: true
    })
    ack && ack({ ok: true })
  })

  socket.on('chat:delete', (payload, ack) => {
    const target = getTarget(store, user, payload && payload.target)
    if (!target) return ack && ack({ error: 'Invalid target' })
    const idx = target.list.findIndex((m) => m.id === payload.messageId)
    if (idx === -1) return ack && ack({ error: 'Message not found' })
    const msg = target.list[idx]
    if (msg.authorId !== user.id) return ack && ack({ error: 'You can only delete your own messages' })
    target.list.splice(idx, 1)
    persist()
    io.to(roomFor(payload.target)).emit('chat:delete', {
      target: payload.target,
      messageId: msg.id
    })
    ack && ack({ ok: true })
  })

  socket.on('react:add', (payload, ack) => {
    const target = getTarget(store, user, payload && payload.target)
    if (!target) return ack && ack({ error: 'Invalid target' })
    const msg = target.list.find((m) => m.id === payload.messageId)
    if (!msg) return ack && ack({ error: 'Message not found' })
    const emoji = String(payload.emoji || '').slice(0, 8)
    if (!emoji) return ack && ack({ error: 'Invalid emoji' })
    msg.reactions[emoji] = msg.reactions[emoji] || []
    if (!msg.reactions[emoji].includes(user.id)) msg.reactions[emoji].push(user.id)
    persist()
    io.to(roomFor(payload.target)).emit('react', {
      target: payload.target,
      messageId: msg.id,
      emoji,
      userId: user.id,
      add: true
    })
    ack && ack({ ok: true })
  })

  socket.on('react:remove', (payload, ack) => {
    const target = getTarget(store, user, payload && payload.target)
    if (!target) return ack && ack({ error: 'Invalid target' })
    const msg = target.list.find((m) => m.id === payload.messageId)
    if (!msg) return ack && ack({ error: 'Message not found' })
    const emoji = String(payload.emoji || '')
    if (msg.reactions[emoji]) {
      msg.reactions[emoji] = msg.reactions[emoji].filter((id) => id !== user.id)
      if (!msg.reactions[emoji].length) delete msg.reactions[emoji]
    }
    persist()
    io.to(roomFor(payload.target)).emit('react', {
      target: payload.target,
      messageId: msg.id,
      emoji,
      userId: user.id,
      add: false
    })
    ack && ack({ ok: true })
  })

  socket.on('typing:start', (payload) => {
    const target = getTarget(store, user, payload && payload.target)
    if (!target) return
    socket.to(roomFor(payload.target)).emit('typing', {
      target: payload.target,
      userId: user.id,
      username: user.username
    })
    if (socket.data.typing.has(payload.target.id)) clearTimeout(socket.data.typing.get(payload.target.id))
    const t = setTimeout(() => {
      socket.to(roomFor(payload.target)).emit('typing:clear', {
        target: payload.target,
        userId: user.id
      })
      socket.data.typing.delete(payload.target.id)
    }, 4000)
    socket.data.typing.set(payload.target.id, t)
  })

  socket.on('room:join', (payload) => {
    const target = getTarget(store, user, payload && payload.target)
    if (!target) return
    socket.join(roomFor(payload.target))
  })

  socket.on('pin:add', (payload, ack) => {
    const target = getTarget(store, user, payload && payload.target)
    if (!target) return ack && ack({ error: 'Invalid target' })
    const msg = target.list.find((m) => m.id === payload.messageId)
    if (!msg) return ack && ack({ error: 'Message not found' })
    msg.pinned = true
    persist()
    io.to(roomFor(payload.target)).emit('pin:update', { target: payload.target, messageId: msg.id, pinned: true })
    ack && ack({ ok: true })
  })

  socket.on('pin:remove', (payload, ack) => {
    const target = getTarget(store, user, payload && payload.target)
    if (!target) return ack && ack({ error: 'Invalid target' })
    const msg = target.list.find((m) => m.id === payload.messageId)
    if (!msg) return ack && ack({ error: 'Message not found' })
    msg.pinned = false
    persist()
    io.to(roomFor(payload.target)).emit('pin:update', { target: payload.target, messageId: msg.id, pinned: false })
    ack && ack({ ok: true })
  })

  socket.on('voice:join', (payload, ack) => {
    const ch = store.channels[payload && payload.channelId]
    if (!ch || ch.type !== 'voice') return ack && ack({ error: 'Invalid voice channel' })
    if (!isMember(store, user, ch.serverId)) return ack && ack({ error: 'Not a member' })
    for (const [chId, members] of voiceRooms) {
      if (members.has(user.id) && chId !== ch.id) {
        members.delete(user.id)
        socket.leave(`voice:${chId}`)
      }
    }
    voiceRooms.set(ch.id, voiceRooms.get(ch.id) || new Set())
    voiceRooms.get(ch.id).add(user.id)
    socket.join(`voice:${ch.id}`)
    socket.data.voiceChannel = ch.id
    broadcastVoice(ch.serverId)
    ack && ack({ ok: true, members: [...voiceRooms.get(ch.id)] })
  })

  socket.on('voice:leave', (payload, ack) => {
    const chId = payload && payload.channelId
    const room = voiceRooms.get(chId)
    if (room) {
      room.delete(user.id)
      socket.leave(`voice:${chId}`)
      if (!room.size) voiceRooms.delete(chId)
    }
    socket.data.voiceChannel = null
    if (chId) {
      const ch = store.channels[chId]
      if (ch) broadcastVoice(ch.serverId)
    }
    ack && ack({ ok: true })
  })

  socket.on('voice:speaking', (payload) => {
    const chId = socket.data.voiceChannel
    if (!chId) return
    const ch = store.channels[chId]
    if (!ch) return
    io.to(`voice:${chId}`).emit('voice:speaking', {
      channelId: chId,
      userId: user.id,
      speaking: !!payload.speaking
    })
  })

  socket.on('call:invite', (payload, ack) => {
    const to = payload && payload.to
    const targetUser = to ? store.users[to] : null
    if (!targetUser) return ack && ack({ error: 'User not found' })
    if (!canCallUsers(store, user.id, to)) return ack && ack({ error: 'You must be friends to call' })
    const call = (payload && payload.call) || {}
    if (!call.roomId) return ack && ack({ error: 'Missing call' })
    io.to(`user:${to}`).emit('call:invite', {
      from: user.id,
      user: publicUser(user),
      call: { roomId: String(call.roomId).slice(0, 120), kind: call.kind === 'voice' ? 'voice' : 'dm', dmId: call.dmId || null }
    })
    ack && ack({ ok: true })
  })

  socket.on('call:accept', (payload, ack) => {
    const to = payload && payload.to
    if (!to || !store.users[to]) return ack && ack({ error: 'User not found' })
    io.to(`user:${to}`).emit('call:accept', {
      from: user.id,
      user: publicUser(user),
      roomId: String((payload && payload.roomId) || '')
    })
    ack && ack({ ok: true })
  })

  socket.on('call:decline', (payload, ack) => {
    const to = payload && payload.to
    if (!to || !store.users[to]) return ack && ack({ error: 'User not found' })
    io.to(`user:${to}`).emit('call:decline', {
      from: user.id,
      user: publicUser(user),
      roomId: String((payload && payload.roomId) || '')
    })
    ack && ack({ ok: true })
  })

  socket.on('call:signal', (payload) => {
    const to = payload && payload.to
    if (!to || !store.users[to]) return
    io.to(`user:${to}`).emit('call:signal', {
      from: user.id,
      roomId: String((payload && payload.roomId) || ''),
      data: (payload && payload.data) || {}
    })
  })

  socket.on('call:leave', (payload) => {
    const to = payload && payload.to
    if (to && store.users[to]) {
      io.to(`user:${to}`).emit('call:leave', {
        from: user.id,
        roomId: String((payload && payload.roomId) || '')
      })
    }
  })

  socket.on('disconnect', () => {
    const chId = socket.data.voiceChannel
    if (chId) {
      const room = voiceRooms.get(chId)
      if (room) {
        room.delete(user.id)
        if (!room.size) voiceRooms.delete(chId)
      }
      const ch = store.channels[chId]
      if (ch) broadcastVoice(ch.serverId)
    }
    online.set(user.id, Math.max(0, (online.get(user.id) || 1) - 1))
    for (const t of socket.data.typing.values()) clearTimeout(t)
    if (!isOnline(user.id)) {
      io.to('presence').emit('presence', { userId: user.id, online: false, status: user.status })
    }
  })
})

server.listen(PORT, () => {
  console.log(`Underground server listening on http://localhost:${PORT}`)
})

const CLIENT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'client', 'dist')
if (fs.existsSync(CLIENT_DIR)) {
  app.use(express.static(CLIENT_DIR, {
    maxAge: '7d',
    immutable: true,
    setHeaders: (res, filePath) => {
      if (path.basename(filePath) === 'index.html' || path.extname(filePath) === '.html') {
        res.setHeader('Cache-Control', 'no-cache')
      }
    }
  }))
  app.get('*', (_req, res) => res.sendFile(path.join(CLIENT_DIR, 'index.html')))
  console.log('Serving client build from', CLIENT_DIR)
} else {
  console.log('No client build found — API only. Run `npm run build` to serve the UI from this server.')
}

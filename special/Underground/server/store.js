import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { encText, decText } from './cipher.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const STORE_FILE = path.join(DATA_DIR, 'store.json')

const EMPTY_STORE = {
  users: {},
  sessions: {},
  servers: {},
  channels: {},
  threads: {},
  messages: {},
  dms: {},
  dmMessages: {}
}

let store = load()

// Personal fields (username/email) are obfuscated at rest; decode into
// memory so the rest of the app works with plaintext.
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

export function uid(prefix = '') {
  return prefix + crypto.randomBytes(8).toString('hex')
}

export function now() {
  return new Date().toISOString()
}

function load() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const st = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'))
      openStore(st)
      return st
    }
  } catch (err) {
    console.error('Failed to read store, starting fresh:', err.message)
  }
  return structuredClone(EMPTY_STORE)
}

let writeTimer = null
export function persist() {
  if (writeTimer) return
  writeTimer = setTimeout(() => {
    writeTimer = null
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
      fs.writeFileSync(STORE_FILE, JSON.stringify(sealStore(store), null, 2), 'utf8')
    } catch (err) {
      console.error('Failed to persist store:', err.message)
    }
  }, 200)
}

export function persistNow() {
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = null
  }
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(STORE_FILE, JSON.stringify(sealStore(store), null, 2), 'utf8')
  } catch (err) {
    console.error('Failed to persist store:', err.message)
  }
}

export function getStore() {
  return store
}

// Backfill any fields added after earlier seeds so old saved data keeps working.
export function migrateStore() {
  let changed = false
  if (!('threads' in store)) { store.threads = {}; changed = true }
  for (const u of Object.values(store.users || {})) {
    if (u.emailVerified === undefined) { u.emailVerified = true; changed = true }
    if (u.phone === undefined) { u.phone = null; changed = true }
    if (u.phoneVerified === undefined) { u.phoneVerified = false; changed = true }
    if (u.twoFactorEnabled === undefined) { u.twoFactorEnabled = false; changed = true }
    if (u.twoFactorSecret === undefined) { u.twoFactorSecret = null; changed = true }
    if (u.twoFactorLast === undefined) { u.twoFactorLast = null; changed = true }
    if (u.backupCodes === undefined) { u.backupCodes = null; changed = true }
  }
  for (const s of Object.values(store.servers || {})) {
    if (!('description' in s)) { s.description = ''; changed = true }
    if (!('banner' in s)) { s.banner = null; changed = true }
    if (!s.iconMedia) { s.iconMedia = null }
    if (!('roles' in s)) { s.roles = {}; changed = true }
    if (!('memberRoles' in s)) { s.memberRoles = {}; changed = true }
    if (!('bans' in s)) { s.bans = {}; changed = true }
    if (!('emojis' in s)) { s.emojis = {}; changed = true }
    if (!('categories' in s)) { s.categories = []; changed = true }
  }
  for (const ch of Object.values(store.channels || {})) {
    if (!('categoryId' in ch)) { ch.categoryId = null; changed = true }
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
        for (const id of s.channelIds) {
          const ch = store.channels[id]
          if (!ch) continue
          if (ch.name === 'announcements' || ch.name === 'general') ch.categoryId = infoCat
          else if (ch.name === 'gaming' || ch.name === 'memes' || ch.name === 'music' || ch.name === 'help' || ch.name === 'off-topic') ch.categoryId = funCat
          else if (ch.type === 'voice') ch.categoryId = vcCat
        }
        changed = true
      }
    }
  }
  if (changed) persistNow()
  return changed
}

export function resetStore() {
  store = structuredClone(EMPTY_STORE)
  persist()
}

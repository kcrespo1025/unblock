const CACHE_KEY = 'underground_cache_v1'
const OUTBOX_KEY = 'underground_outbox_v1'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or unavailable */
  }
}

export function loadCache() {
  return read(CACHE_KEY, null)
}

export function saveCache(patch) {
  const current = loadCache() || {}
  write(CACHE_KEY, { ...current, ...patch })
}

export function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch { /* noop */ }
}

export function loadOutbox() {
  return read(OUTBOX_KEY, [])
}

export function saveOutbox(outbox) {
  write(OUTBOX_KEY, outbox)
}

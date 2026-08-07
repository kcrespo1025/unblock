import { localApi } from './standalone/localServer.js'

const TOKEN_KEY = 'underground_token'

let onAuthError = null

let standalone =
  typeof location !== 'undefined' &&
  (location.protocol === 'file:' || String(location.search || '').includes('standalone=1'))

export function isStandalone() {
  return standalone
}

export function setStandalone(v) {
  standalone = !!v
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class AuthError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AuthError'
    this.auth = true
  }
}

export function setOnAuthError(fn) {
  onAuthError = fn
}

export async function api(path, { method = 'GET', body } = {}) {
  if (standalone) {
    try {
      return await localApi(path, { method, body })
    } catch (err) {
      if (err && err.status === 401) {
        if (onAuthError) onAuthError()
        throw new AuthError(err.message || 'Not authenticated')
      }
      throw err
    }
  }
  const res = await fetch('/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const data = (res.headers.get('content-type') || '').includes('application/json')
    ? await res.json().catch(() => ({}))
    : {}
  if (!res.ok) {
    if (res.status === 401 && data.error === 'Not authenticated') {
      if (onAuthError) onAuthError()
      throw new AuthError(data.error || 'Not authenticated')
    }
    throw new Error(data.error || `Request failed (${res.status})`)
  }
  return data
}

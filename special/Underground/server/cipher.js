import crypto from 'node:crypto'

// Reversible obfuscation for personally-identifying fields (username/email)
// so no plaintext personal data sits in seed files or the on-disk store.
// The key ships with the app (it must, for standalone to work), so this is
// obfuscation, not true secrecy — but casual readers can't recover the data.

const ENC_KEY = 'underground-obfuscation-key:v7'
const key = crypto.createHash('sha256').update(ENC_KEY).digest('hex')

export function encText(str) {
  if (str == null) return str
  if (typeof str === 'string' && str.startsWith('enc:')) return str
  const out = []
  for (let i = 0; i < str.length; i++) out.push(str.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  return 'enc:' + out.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function decText(s) {
  if (typeof s !== 'string' || !s.startsWith('enc:')) return s
  const hex = s.slice(4)
  let out = ''
  for (let i = 0; i + 1 < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key.charCodeAt((i / 2) % key.length))
  }
  return out
}

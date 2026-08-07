export function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatDay(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
}

export function initials(username) {
  return (username || '?').slice(0, 2).toUpperCase()
}

export const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥']

export function parseEmoji(content) {
  const parts = content.split(/(<:[a-zA-Z0-9_]+:\d+>)/g)
  return parts
}

export function emojiName(emoji) {
  const map = {
    '👍': 'thumbsup',
    '❤️': 'heart',
    '😂': 'joy',
    '😮': 'astonished',
    '😢': 'cry',
    '😡': 'angry',
    '🎉': 'tada',
    '🔥': 'fire'
  }
  return map[emoji] || emoji
}

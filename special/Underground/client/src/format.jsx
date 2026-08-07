import React, { useState } from 'react'

export function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

export function formatFullDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString([], {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatRelative(iso) {
  if (!iso) return ''
  const then = new Date(iso)
  const now = new Date()
  const diff = (now - then) / 1000
  if (diff < 60) return 'Now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return formatDay(iso)
}

export function initials(username) {
  return (username || '?').slice(0, 2).toUpperCase()
}

export const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '👀', '💯', '🙏', '✨', '🤔', '💀', '🤝', '🍆', '🥶', '👑']

export const EMOJI_GRID = [
  ['😀', '😁', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🫡', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😴', '🤤', '😪', '😮‍💨', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'],
  ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤌', '🫱', '🫲', '🫳', '🫴', '🤏', '🫰', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💄', '💋', '🫦', '👶', '🧒', '👦', '👧', '🧑', '👨', '👩', '🧔', '👴', '👵', '🙍', '🙎', '🙅', '🙆', '💁', '🙋', '🧏', '🙇', '🤦', '🤷', '💃', '🕺'],
  ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪲', '🦋', '🐌', '🐞', '🐜', '🪰', '🦟', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🐘', '🦏', '🐪', '🐫', '🦒', '🦘', '🦥', '🦦', '🦨', '🦩', '🐿️', '🦔', '🦫', '🐀', '🐁'],
  ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '🫖', '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽️', '🥣', '🥡', '🥢', '🧂'],
  ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🪘', '🎷', '🎺', '🪗', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩'],
  ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '🛟', '🧭', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🕍', '🛕', '🕋', '⛩️', '🛤️', '🛣️', '🗾', '🎑', '🏞️', '🌅', '🌄', '🌠', '🎇', '🎆', '🌇', '🌆', '🏙️', '🌃', '🌌', '🌉', '🌁'],
  ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🪫', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🗑️', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '💊', '💉', '🩸', '🩹', '🩺', '🩻', '🩼', '🌡️', '🧬', '🦠', '🧫', '🧪', '🧹', '🪠', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎️'],
  ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💌', '💋', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤', '🌹', '🥀', '🌷', '🌻', '🌼', '🌸', '🌺', '🍀', '🌿', '☘️', '🌱', '🌵', '🌴', '🌳', '🌲', '🌾', '🍁', '🍂', '🍃', '☀️', '🌞', '🌙', '⭐', '🌟', '💫', '⚡', '☄️', '💥', '🔥', '🌊', '💧', '☔', '🌧️', '⛈️', '🌨️', '❄️', '🌬️', '💨', '🌫️', '🌈', '☂️', '✨', '🎉', '🎊', '🎁', '🎈', '🎀', '🪄', '🎆', '🎇', '🧨', '🕶️', '👓', '🧣', '🧤', '🧥', '🧦', '👑', '🎩', '🎓', '🧢', '⛑️', '💄', '💍', '🌂', '🔮', '🧿', '📿', '🪬', '🕹️', '🎮', '🀄', '🃏', '🂡', '🪅', '🪩', '🪆', '📯', '📻', '🎷', '🎺', '🎸', '🎻', '🥁', '🪘', '🎤', '🎧', '🎼', '🎹', '📻', '🪗', '🪕', '🪇', '🎙️']
]

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

const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?\S*)?$/i

export function isImageUrl(url) {
  try {
    const u = new URL(url)
    if (u.hostname === 'tenor.com' || u.hostname === 'media.tenor.com') return false
    return IMAGE_RE.test(u.pathname)
  } catch {
    return false
  }
}

function Spoiler({ children }) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className={`spoiler ${open ? 'revealed' : ''}`}
      onClick={() => setOpen(true)}
      title={open ? '' : 'Click to reveal spoiler'}
    >
      {children}
    </span>
  )
}

function Mention({ username }) {
  return <span className="mention">@{username}</span>
}

export function CustomEmoji({ emoji }) {
  if (emoji.media) {
    const isImg = /^data:image\//.test(emoji.media) || /^https?:\/\/.*\.(png|jpe?g|gif|webp)/i.test(emoji.media)
    return isImg ? (
      <img className="inline-emoji" src={emoji.media} alt={`:${emoji.name}:`} title={`:${emoji.name}:`} loading="lazy" />
    ) : (
      <video className="inline-emoji" src={emoji.media} alt="" title={`:${emoji.name}:`} muted loop autoPlay playsInline />
    )
  }
  return <span className="inline-emoji-char" title={`:${emoji.name}:`}>{emoji.emoji}</span>
}

export function emojiLookup(customEmoji) {
  if (!customEmoji) return {}
  if (Array.isArray(customEmoji)) {
    const map = {}
    for (const e of customEmoji) map[e.name.toLowerCase()] = e
    return map
  }
  if (typeof customEmoji === 'object') return customEmoji
  return {}
}

function linkify(url) {
  try {
    const u = new URL(url)
    return <span className="url-host">{u.hostname}</span>
  } catch {
    return url
  }
}

export function renderMarkdown(content, usernames = [], customEmoji) {
  const emojiMap = customEmoji ? emojiLookup(customEmoji) : null
  const lines = String(content || '').split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const fence = line.match(/^```(\w*)\s*$/)
    if (fence) {
      const lang = fence[1]
      const buf = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      i++
      blocks.push({ type: 'code', lang, text: buf.join('\n') })
      continue
    }
    if (/^\s*>/.test(line)) {
      const buf = []
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      blocks.push({ type: 'quote', text: buf.join(' ') })
      continue
    }
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line)
      const items = []
      while (i < lines.length && (/^\s*[-*+]\s+/.test(lines[i]) || /^\s*\d+[.)]\s+/.test(lines[i]))) {
        items.push({ ordered, text: lines[i].replace(/^\s*[-*+]\s+/, '').replace(/^\s*\d+[.)]\s+/, '') })
        i++
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }
    const buf = [line]
    i++
    while (i < lines.length && lines[i] !== '' && !/^```/.test(lines[i]) && !/^\s*>/.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i])) {
      buf.push(lines[i])
      i++
    }
    if (buf[0] !== '') blocks.push({ type: 'paragraph', text: buf.join('\n') })
  }

  return blocks.map((block, bi) => {
    if (block.type === 'code') {
      return (
        <pre className="codeblock" key={bi}>
          {block.lang && <div className="codeblock-lang">{block.lang}</div>}
          <code>{block.text}</code>
        </pre>
      )
    }
    if (block.type === 'quote') {
      return (
        <div className="blockquote" key={bi}>
          {renderInline(block.text, usernames, true, emojiMap)}
        </div>
      )
    }
    if (block.type === 'list') {
      const Tag = block.ordered ? 'ol' : 'ul'
      return (
        <Tag className="markdown-list" key={bi}>
          {block.items.map((it, ii) => (
            <li key={ii}>{renderInline(it.text, usernames, true, emojiMap)}</li>
          ))}
        </Tag>
      )
    }
    return <div className="md-paragraph" key={bi}>{renderInline(block.text, usernames, true, emojiMap)}</div>
  })
}

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|`[^`]+`|\|\|[^|]+\|\||:[A-Za-z0-9_+]{2,6}:|@everyone|@here|@[\w-]+|https?:\/\/[^\s()<>]+|.)/g

export function renderInline(text, usernames = [], allowImages = true, customEmoji) {
  const tokens = String(text).match(INLINE_RE)
  if (!tokens) return text
  const nodes = []
  let buf = ''
  const flush = () => {
    if (buf) {
      nodes.push(buf)
      buf = ''
    }
  }
  const names = new Set((usernames || []).map((n) => n.toLowerCase()))
  for (const token of tokens) {
    if (token === '**' || token === '*' || token === '`' || token === '~~' || token === '||') {
      buf += token
      continue
    }
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      flush()
      nodes.push(<strong key={nodes.length}>{renderInline(token.slice(2, -2), usernames, allowImages, customEmoji)}</strong>)
      continue
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      flush()
      nodes.push(<em key={nodes.length}>{renderInline(token.slice(1, -1), usernames, allowImages, customEmoji)}</em>)
      continue
    }
    if (token.startsWith('~~') && token.endsWith('~~') && token.length > 4) {
      flush()
      nodes.push(<s key={nodes.length}>{renderInline(token.slice(2, -2), usernames, allowImages, customEmoji)}</s>)
      continue
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      flush()
      nodes.push(<code className="inline-code" key={nodes.length}>{token.slice(1, -1)}</code>)
      continue
    }
    if (token.startsWith('||') && token.endsWith('||') && token.length > 4) {
      flush()
      nodes.push(<Spoiler key={nodes.length}>{renderInline(token.slice(2, -2), usernames, allowImages, customEmoji)}</Spoiler>)
      continue
    }
    if (/^:[A-Za-z0-9_+]{2,6}:$/.test(token) && customEmoji) {
      const found = customEmoji[token.slice(1, -1).toLowerCase()]
      if (found) {
        flush()
        nodes.push(<CustomEmoji key={nodes.length} emoji={found} />)
        continue
      }
    }
    if (token === '@everyone' || token === '@here') {
      flush()
      nodes.push(<span className="mention mention-strong" key={nodes.length}>{token}</span>)
      continue
    }
    if (token.startsWith('@') && token.length > 1) {
      const name = token.slice(1)
      flush()
      nodes.push(
        names.has(name.toLowerCase())
          ? <span className="mention mention-strong" key={nodes.length}>{token}</span>
          : <span key={nodes.length}>{token}</span>
      )
      continue
    }
    if (/^https?:\/\//.test(token)) {
      flush()
      if (allowImages && isImageUrl(token)) {
        nodes.push(
          <span className="img-embed" key={nodes.length}>
            <a href={token} target="_blank" rel="noreferrer">
              <img src={token} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />
            </a>
            <a className="img-url" href={token} target="_blank" rel="noreferrer">{linkify(token)}</a>
          </span>
        )
      } else {
        nodes.push(
          <a key={nodes.length} href={token} target="_blank" rel="noreferrer" className="msg-link">
            {token}
          </a>
        )
      }
      continue
    }
    buf += token
  }
  flush()
  return nodes
}

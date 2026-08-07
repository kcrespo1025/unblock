import { useEffect, useMemo, useRef, useState } from 'react'
import Avatar from './Avatar.jsx'

export default function QuickSwitcher({ servers, dms, onOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const items = useMemo(() => {
    const out = []
    for (const s of servers || []) {
      const textChannels = (s.channels || []).filter((c) => c.type !== 'voice')
      if (textChannels.length) {
        out.push({ kind: 'server', id: `srv-${s.id}`, label: s.name, sub: 'Server', icon: s.icon || '🌐', serverId: s.id, channelId: textChannels[0].id })
      }
      for (const c of textChannels) {
        out.push({ kind: 'channel', id: `ch-${c.id}`, label: `#${c.name}`, sub: s.name, icon: '#', serverId: s.id, channelId: c.id })
      }
      for (const t of s.threads || []) {
        out.push({ kind: 'thread', id: `th-${t.id}`, label: t.name, sub: `Thread in #${(s.channels.find((c) => c.id === t.channelId) || {}).name || '…'} · ${s.name}`, icon: '🧵', serverId: s.id, threadId: t.id, channelId: t.channelId })
      }
    }
    for (const dm of dms || []) {
      out.push({ kind: 'dm', id: `dm-${dm.id}`, label: dm.recipient.username, sub: 'Direct Message', icon: '@', dmId: dm.id, recipient: dm.recipient })
    }
    return out
  }, [servers, dms])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items.slice(0, 40)
    const words = q.split(/\s+/).filter(Boolean)
    return items
      .filter((it) => {
        const hay = `${it.label} ${it.sub}`.toLowerCase()
        return words.every((w) => hay.includes(w))
      })
      .slice(0, 40)
  }, [items, query])

  useEffect(() => {
    setSelected(0)
  }, [query])

  useEffect(() => {
    const el = listRef.current && listRef.current.children[selected]
    el && el.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const pick = (it) => {
    if (!it) return
    onOpen(it)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(filtered[selected])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div className="quick-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="quick-panel">
        <input
          ref={inputRef}
          className="quick-input"
          placeholder="Jump to a channel, thread, or DM…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="quick-list" ref={listRef}>
          {filtered.length === 0 && <div className="quick-empty">No results for “{query}”</div>}
          {filtered.map((it, i) => (
            <button
              key={it.id}
              className={`quick-item ${i === selected ? 'active' : ''}`}
              onMouseEnter={() => setSelected(i)}
              onClick={() => pick(it)}
            >
              {it.kind === 'dm' ? (
                <Avatar user={it.recipient} size={32} />
              ) : (
                <span className="quick-icon">{it.icon}</span>
              )}
              <span className="quick-label">{it.label}</span>
              <span className="quick-sub">{it.sub}</span>
              <span className="quick-kind">{it.kind}</span>
            </button>
          ))}
        </div>
        <div className="quick-footer">
          <span><b>↑↓</b> navigate</span>
          <span><b>↵</b> open</span>
          <span><b>esc</b> close</span>
        </div>
      </div>
    </div>
  )
}

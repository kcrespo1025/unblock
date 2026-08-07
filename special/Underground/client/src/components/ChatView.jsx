import { useEffect, useMemo, useRef, useState } from 'react'
import Message from './Message.jsx'
import EmojiPicker from './EmojiPicker.jsx'
import Avatar from './Avatar.jsx'
import { formatDay, renderInline, emojiLookup } from '../format.jsx'
import { soundSend } from '../sounds.js'
import { STICKERS } from '../stickers.js'
import { SearchIcon, PinIcon, UsersIcon, ReplyIcon, SmileIcon, StickerIcon, PlusIcon, CloseIcon, ArrowUpIcon, ThreadIcon, PhoneIcon, VideoIcon } from '../icons.jsx'

export default function ChatView({
  title,
  topic,
  headerIcon,
  messages,
  typingUsers,
  me,
  members,
  roles,
  friendStates,
  membersVisible,
  onToggleMembers,
  onSend,
  onTyping,
  onReact,
  onEdit,
  onDelete,
  onPin,
  onOpenProfile,
  onAddFriend,
  onOpenDm,
  onCreateThread,
  onOpenThread,
  onSearch,
  onTogglePins,
  pinCount,
  scrollTarget,
  onScrollTargetDone,
  hasMore,
  onLoadEarlier,
  customEmoji,
  onCall,
  onVideoCall,
  callBar
}) {
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [attachment, setAttachment] = useState(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [stickerOpen, setStickerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [mention, setMention] = useState(null)
  const [cursorPos, setCursorPos] = useState(0)

  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const stickToBottom = useRef(true)
  const fileRef = useRef(null)
  const loadingEarlier = useRef(false)

  const lastMsgId = messages.length ? messages[messages.length - 1].id : null

  useEffect(() => {
    if (stickToBottom.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    }
  }, [lastMsgId, title])

  useEffect(() => {
    if (!scrollTarget) return
    const el = document.getElementById(`msg-${scrollTarget}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => {
        el.classList.add('highlight')
        setTimeout(() => el.classList.remove('highlight'), 2000)
      }, 300)
    }
    onScrollTargetDone && onScrollTargetDone(scrollTarget)
  }, [scrollTarget])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (hasMore && !loadingEarlier.current && el.scrollTop < 80) {
      loadingEarlier.current = true
      const prevHeight = el.scrollHeight
      const prevTop = el.scrollTop
      Promise.resolve(onLoadEarlier && onLoadEarlier()).finally(() => {
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - prevHeight + prevTop
          loadingEarlier.current = false
        })
      })
    }
  }

  const usernameSet = useMemo(() => (members || []).map((m) => m.username), [members])

  const mentionSuggestions = useMemo(() => {
    const specials = []
    if (!mention) return []
    const q = mention.query.toLowerCase()
    if (q === '' || 'everyone'.startsWith(q) || 'everyone'.includes(q)) specials.push({ id: '@everyone', username: 'everyone', special: 'everyone' })
    if (q === '' || 'here'.startsWith(q) || 'here'.includes(q)) specials.push({ id: '@here', username: 'here', special: 'here' })
    const list = (members || []).filter((m) => m.id !== me.id)
    const filtered = q ? list.filter((m) => m.username.toLowerCase().includes(q)).slice(0, 8) : list.slice(0, 8)
    return [...specials, ...filtered]
  }, [mention, members, me])

  const detectMention = (value, pos) => {
    if (pos === undefined) return null
    const before = value.slice(0, pos)
    const match = before.match(/@([\w-]*)$/)
    if (match && match[0].length > 0) {
      const start = before.length - match[0].length
      return { start, end: pos, query: match[1] }
    }
    return null
  }

  const onChange = (e) => {
    const v = e.target.value
    const pos = e.target.selectionStart
    setDraft(v)
    setCursorPos(pos)
    setMention(detectMention(v, pos))
    onTyping()
  }

  const applyMention = (username) => {
    if (!mention) return
    const before = draft.slice(0, mention.start)
    const after = draft.slice(mention.end)
    const next = before + `@${username} ` + after
    setDraft(next)
    setMention(null)
    const pos = before.length + username.length + 2
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(pos, pos)
    })
  }

  const submit = () => {
    const content = draft.trim()
    if (!content && !attachment) return
    soundSend()
    onSend(content, { replyTo, attachment })
    setDraft('')
    setReplyTo(null)
    setAttachment(null)
    stickToBottom.current = true
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }))
  }

  const pickFile = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      alert('File too large (max 4 MB)')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAttachment({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const groupedGroups = (() => {
    return messages.map((m, i) => {
      const prev = messages[i - 1]
      let showDay = null
      const d = formatDay(m.createdAt)
      if (!prev || formatDay(prev.createdAt) !== d) showDay = d
      const grouped =
        prev && prev.author.id === m.author.id &&
        !prev.author.system && !m.author.system &&
        !showDay &&
        new Date(m.createdAt) - new Date(prev.createdAt) < 5 * 60 * 1000
      return { m, grouped, showDay }
    })
  })()

  const roleFor = (userId) => (roles && roles[userId]) || null
  const friendStateFor = (userId) => (friendStates && friendStates[userId]) || 'none'
  const emojiMap = useMemo(() => emojiLookup(customEmoji), [customEmoji])

  return (
    <div className="chat-wrap">
      <div className="chat-header">
        <span className="hash">{headerIcon}</span>
        <span>{title}</span>
        {topic && (
          <>
            <span className="divider" />
            <span className="topic">{topic}</span>
          </>
        )}
        <div className="header-actions">
          {onCall && (
            <button className="icon-btn" title="Start a voice call" onClick={onCall}><PhoneIcon size={18} /></button>
          )}
          {onVideoCall && (
            <button className="icon-btn" title="Start a video call" onClick={onVideoCall}><VideoIcon size={18} /></button>
          )}
          <button className={`icon-btn ${searchOpen ? 'active' : ''}`} title="Search" onClick={() => setSearchOpen((v) => !v)}><SearchIcon size={18} /></button>
          <button className="icon-btn" title="Pinned messages" onClick={onTogglePins}>
            <PinIcon size={18} />
            {pinCount > 0 && <span className="icon-btn-badge">{pinCount}</span>}
          </button>
          <button className="members-btn" onClick={onToggleMembers}><UsersIcon size={20} /></button>
        </div>
      </div>

      {searchOpen && (
        <div className="search-bar">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch(searchQuery)}
            placeholder="Search messages…  (Enter to search)"
            autoFocus
          />
          <button className="btn btn-primary" onClick={() => onSearch(searchQuery)}>Search</button>
        </div>
      )}

      <div className="messages" ref={scrollRef} onScroll={onScroll}>
        {hasMore && (
          <div className="load-earlier">
            <button
              onClick={() => {
                const el = scrollRef.current
                const prevHeight = el ? el.scrollHeight : 0
                const prevTop = el ? el.scrollTop : 0
                loadingEarlier.current = true
                Promise.resolve(onLoadEarlier && onLoadEarlier()).finally(() => {
                  requestAnimationFrame(() => {
                    if (el) el.scrollTop = el.scrollHeight - prevHeight + prevTop
                    loadingEarlier.current = false
                  })
                })
              }}
            >
              <ArrowUpIcon size={14} /> Load earlier messages
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="big">👋</div>
            <h2>Welcome to {headerIcon} {title}!</h2>
            <p>This is the start of the conversation.</p>
          </div>
        )}
        {groupedGroups.map(({ m, grouped, showDay }) => (
          <Message
            key={m.id}
            id={m.id}
            message={m}
            grouped={grouped}
            showDay={showDay}
            me={me}
            usernames={usernameSet}
            role={roleFor(m.author.id)}
            friendState={friendStateFor(m.author.id)}
            customEmoji={emojiMap}
            onReact={(messageId, emoji) => onReact(messageId, emoji)}
            onEdit={onEdit}
            onDelete={onDelete}
            onPin={onPin}
            onReply={(msg) => {
              setReplyTo({ messageId: msg.id, authorName: msg.author.username, content: msg.content, authorColor: msg.author.color })
              inputRef.current?.focus()
            }}
            onOpenProfile={(author) => onOpenProfile(author)}
            onAddFriend={(author) => onAddFriend(author)}
            onOpenDm={(author) => onOpenDm(author)}
            onCreateThread={onCreateThread}
            onOpenThread={onOpenThread}
          />
        ))}
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            <span className="dots"><span /><span /><span /></span>
            <span>
              {typingUsers.length === 1
                ? <strong>{typingUsers[0].username}</strong>
                : <strong>{typingUsers.length} people</strong>}{' '}
              {typingUsers.length === 1 ? 'is' : 'are'} typing…
            </span>
          </div>
        )}
      </div>

      {replyTo && (
        <div className="reply-bar">
          <span className="reply-bar-arrow"><ReplyIcon size={16} /></span>
          <div className="reply-bar-info">
            <span className="reply-bar-name" style={{ color: replyTo.authorColor }}>Replying to {replyTo.authorName}</span>
            <span className="reply-bar-text">{renderInline(replyTo.content.slice(0, 100))}</span>
          </div>
          <button className="reply-bar-x" onClick={() => setReplyTo(null)}><CloseIcon size={16} /></button>
        </div>
      )}

      {attachment && (
        <div className="attach-bar">
          <img className="attach-thumb" src={attachment.dataUrl} alt="" />
          <div className="attach-info">
            <span className="attach-name">{attachment.name}</span>
            <span className="attach-size">{(attachment.size / 1024).toFixed(1)} KB</span>
          </div>
          <button className="reply-bar-x" onClick={() => setAttachment(null)}><CloseIcon size={16} /></button>
        </div>
      )}

      {callBar}

      <div className="chat-input-wrap">
        <div className="chat-input">
          <button className="tool-btn" title="Add emoji" onClick={() => { setEmojiOpen((v) => !v); setStickerOpen(false) }}><SmileIcon size={22} /></button>
          <button className="tool-btn" title="Stickers" onClick={() => { setStickerOpen((v) => !v); setEmojiOpen(false) }}><StickerIcon size={22} /></button>
          <button className="tool-btn" title="Attach file" onClick={() => fileRef.current?.click()}><PlusIcon size={22} /></button>
          <input ref={fileRef} type="file" hidden onChange={pickFile} />
          <textarea
            rows={1}
            ref={inputRef}
            value={draft}
            placeholder={`Message ${title}`}
            onChange={onChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (mention) {
                  if (mentionSuggestions[0]) applyMention(mentionSuggestions[0].username)
                  return
                }
                submit()
              }
              if (e.key === 'ArrowDown' && mention) e.preventDefault()
            }}
            autoFocus
          />
          <button className="send-btn" onClick={submit} disabled={!draft.trim() && !attachment}>
            <ArrowUpIcon size={20} />
          </button>
        </div>
        {emojiOpen && (
          <div style={{ position: 'absolute', bottom: '76px', right: '16px', zIndex: 40 }}>
            <EmojiPicker
              onPick={(e) => { setDraft((d) => d + e); setEmojiOpen(false); inputRef.current?.focus() }}
              onClose={() => setEmojiOpen(false)}
              customEmoji={customEmoji}
            />
          </div>
        )}
        {stickerOpen && (
          <div className="sticker-picker" style={{ bottom: '76px', right: '16px', zIndex: 40 }}>
            <div className="sticker-picker-title">Stickers</div>
            <div className="sticker-grid">
              {STICKERS.map((s) => (
                <button
                  key={s.name}
                  className="sticker-cell"
                  title={s.name}
                  onClick={() => {
                    soundSend()
                    onSend('', { sticker: { name: s.name, emoji: s.emoji } })
                    setStickerOpen(false)
                  }}
                >
                  <span className="sticker-emoji">{s.emoji}</span>
                  <span className="sticker-name">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {mention && mentionSuggestions.length > 0 && (
        <div className="mention-popup">
          {mentionSuggestions.map((m) => (
            <button key={m.id} className={`mention-option ${m.special ? 'special' : ''}`} onClick={() => applyMention(m.username)}>
              {m.special ? (
                <span className="mention-special-icon">@</span>
              ) : (
                <Avatar user={m} size={24} />
              )}
              <span className="mention-opt-name">{m.special ? `@${m.username}` : `@${m.username}`}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

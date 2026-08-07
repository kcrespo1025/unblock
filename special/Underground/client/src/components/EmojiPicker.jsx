import { useState } from 'react'
import { EMOJI_GRID } from '../format.jsx'

export default function EmojiPicker({ onPick, onClose, customEmoji = [] }) {
  const [search, setSearch] = useState('')
  const flat = EMOJI_GRID.flat()
  const filtered = search ? flat.filter((e) => e.includes(search)) : null
  const customFiltered = search
    ? customEmoji.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : customEmoji

  return (
    <div className="emoji-picker" onMouseDown={(e) => e.stopPropagation()}>
      <div className="emoji-search">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emojis…"
          autoFocus
        />
      </div>
      {customFiltered.length > 0 && (
        <>
          <div className="emoji-section-title">Custom</div>
          <div className="emoji-grid">
            {customFiltered.map((e) => (
              <button key={e.id} className="emoji-cell" title={`:${e.name}:`} onClick={() => { onPick(`:${e.name}:`); onClose() }}>
                {e.media ? (
                  /^data:image\//.test(e.media) || /^https?:\/\/.*\.(png|jpe?g|gif|webp)/i.test(e.media) ? (
                    <img className="emoji-cell-img" src={e.media} alt={`:${e.name}:`} />
                  ) : (
                    <video className="emoji-cell-img" src={e.media} muted loop autoPlay playsInline />
                  )
                ) : (
                  e.emoji
                )}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="emoji-section-title">Standard</div>
      <div className="emoji-grid">
        {(filtered || flat).map((e, i) => (
          <button key={i} className="emoji-cell" onClick={() => { onPick(e); onClose() }}>
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}

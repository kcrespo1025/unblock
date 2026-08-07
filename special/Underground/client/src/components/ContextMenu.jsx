import { useEffect, useRef } from 'react'

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const close = () => onClose()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('click', close)
    document.addEventListener('contextmenu', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('contextmenu', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (x + rect.width > window.innerWidth) el.style.left = `${x - rect.width}px`
    else el.style.left = `${x}px`
    if (y + rect.height > window.innerHeight) el.style.top = `${Math.max(8, y - rect.height)}px`
    else el.style.top = `${y}px`
  }, [x, y])

  return (
    <div className="context-menu" ref={ref} style={{ left: x, top: y }} onMouseDown={(e) => e.stopPropagation()}>
      {items.map((item, i) =>
        item === 'divider' ? (
          <div className="ctx-divider" key={i} />
        ) : (
          <button
            key={i}
            className={`ctx-item ${item.danger ? 'danger' : ''}`}
            onClick={() => { item.onClick(); onClose() }}
          >
            <span className="ctx-label">{item.label}</span>
            {item.hint && <span className="ctx-hint">{item.hint}</span>}
          </button>
        )
      )}
    </div>
  )
}

import { useMemo } from 'react'
import { encodeQr } from '../qr.js'

export default function QRCode({ value, size = 160, className = '' }) {
  const qr = useMemo(() => (value ? encodeQr(value) : null), [value])
  if (!qr) return null
  const n = qr.size
  let d = ''
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.modules[y][x]) d += `M${x + 4},${y + 4}h1v1h-1z`
    }
  }
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${n + 8} ${n + 8}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR code"
    >
      <rect width={n + 8} height={n + 8} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  )
}

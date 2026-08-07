let ctx = null
let enabled = true

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (AC) ctx = new AC()
  }
  return ctx
}

export function setSoundsEnabled(on) {
  enabled = on
}

function tone(freq, start, dur, type = 'sine', gain = 0.08) {
  const c = ensureCtx()
  if (!c || !enabled) return
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, c.currentTime + start)
  g.gain.setValueAtTime(0, c.currentTime + start)
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur)
  osc.connect(g)
  g.connect(c.destination)
  osc.start(c.currentTime + start)
  osc.stop(c.currentTime + start + dur + 0.05)
}

export function unlockAudio() {
  ensureCtx()
  if (ctx && ctx.state === 'suspended') ctx.resume()
}

export function soundSend() {
  tone(520, 0, 0.06, 'sine', 0.05)
  tone(680, 0.05, 0.06, 'sine', 0.04)
}

export function soundPop() {
  tone(880, 0, 0.08, 'sine', 0.06)
  tone(1100, 0.03, 0.07, 'sine', 0.04)
}

export function soundPing() {
  tone(1174.66, 0, 0.18, 'sine', 0.12)
  tone(880, 0.18, 0.28, 'sine', 0.12)
}

export function soundJoin() {
  tone(523, 0, 0.09, 'triangle', 0.08)
  tone(784, 0.08, 0.12, 'triangle', 0.08)
}

export function soundLeave() {
  tone(784, 0, 0.09, 'triangle', 0.08)
  tone(523, 0.08, 0.12, 'triangle', 0.08)
}

export function soundRing() {
  tone(659, 0, 0.22, 'sine', 0.1)
  tone(784, 0.02, 0.2, 'sine', 0.07)
  tone(659, 0.32, 0.22, 'sine', 0.1)
  tone(784, 0.34, 0.2, 'sine', 0.07)
}

export function soundCallConnected() {
  tone(880, 0, 0.09, 'sine', 0.07)
  tone(1108, 0.09, 0.14, 'sine', 0.07)
}

export function soundCallEnded() {
  tone(587, 0, 0.1, 'sine', 0.07)
  tone(440, 0.1, 0.16, 'sine', 0.06)
}

export function soundCallDecline() {
  tone(415, 0, 0.12, 'sine', 0.08)
  tone(311, 0.12, 0.2, 'sine', 0.07)
}

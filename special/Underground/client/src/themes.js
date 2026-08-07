// Appearance configuration for Underground.
// Every theme, accent, gradient, banner, emoji and chat-background lives here
// and is applied at runtime through CSS variables on <html>, so everything
// updates instantly with zero reloads.

const CFG_PREFIX = 'underground_cfg_'

export function readCfg(key, fallback) {
  try {
    const raw = localStorage.getItem(CFG_PREFIX + key)
    return raw === null ? fallback : raw
  } catch {
    return fallback
  }
}

export function writeCfg(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(CFG_PREFIX + key)
    else localStorage.setItem(CFG_PREFIX + key, String(value))
  } catch { /* quota / disabled */ }
}

export const THEMES = [
  {
    id: 'dark',
    name: 'Dark',
    icon: '🌙',
    accent: '#5865f2',
    palette: {
      bgRail: '#1e1f22',
      bgSidebar: '#2b2d31',
      bgChat: '#313338',
      bgInput: '#383a40',
      bgHover: '#35373c',
      bgActive: '#404249',
      bgUserpanel: '#232428',
      bgModal: '#313338',
      bgMessageHover: '#2e3035',
      textNormal: '#dbdee1',
      textMuted: '#949ba4',
      textSecondary: '#b5bac1',
      textLink: '#00a8fc',
      danger: '#f23f43',
      online: '#23a55a',
      idle: '#f0b232',
      dnd: '#f23f43',
      offline: '#80848e',
      divider: '#26272c'
    }
  },
  {
    id: 'light',
    name: 'Light',
    icon: '☀️',
    accent: '#5865f2',
    palette: {
      bgRail: '#f2f3f5',
      bgSidebar: '#e3e5e8',
      bgChat: '#ffffff',
      bgInput: '#e9ebef',
      bgHover: '#d9dce1',
      bgActive: '#c8ccd2',
      bgUserpanel: '#ebedef',
      bgModal: '#f2f3f5',
      bgMessageHover: '#f5f6f7',
      textNormal: '#313338',
      textMuted: '#6d6f78',
      textSecondary: '#4e5058',
      textLink: '#00a8fc',
      danger: '#f23f43',
      online: '#23a55a',
      idle: '#f0b232',
      dnd: '#f23f43',
      offline: '#80848e',
      divider: '#dfe1e4'
    }
  },
  {
    id: 'amoled',
    name: 'AMOLED',
    icon: '⬛',
    accent: '#5865f2',
    palette: {
      bgRail: '#000000',
      bgSidebar: '#0a0a0c',
      bgChat: '#000000',
      bgInput: '#161618',
      bgHover: '#101013',
      bgActive: '#1a1a1e',
      bgUserpanel: '#050506',
      bgModal: '#0c0c0f',
      bgMessageHover: '#0a0a0d',
      textNormal: '#dbdee1',
      textMuted: '#6e7178',
      textSecondary: '#a6aab1',
      textLink: '#00a8fc',
      danger: '#f23f43',
      online: '#23a55a',
      idle: '#f0b232',
      dnd: '#f23f43',
      offline: '#80848e',
      divider: '#0d0d0f'
    }
  },
  {
    id: 'midnight',
    name: 'Midnight',
    icon: '🌌',
    accent: '#5865f2',
    palette: {
      bgRail: '#10131c',
      bgSidebar: '#171a24',
      bgChat: '#1c1f2b',
      bgInput: '#232735',
      bgHover: '#202430',
      bgActive: '#2a2f40',
      bgUserpanel: '#12151d',
      bgModal: '#1c1f2b',
      bgMessageHover: '#191c26',
      textNormal: '#e3e5eb',
      textMuted: '#8b90a0',
      textSecondary: '#b2b6c4',
      textLink: '#00a8fc',
      danger: '#f23f43',
      online: '#23a55a',
      idle: '#f0b232',
      dnd: '#f23f43',
      offline: '#80848e',
      divider: '#141722'
    }
  },
  {
    id: 'forest',
    name: 'Forest',
    icon: '🌲',
    accent: '#23a55a',
    palette: {
      bgRail: '#0f1713',
      bgSidebar: '#14201a',
      bgChat: '#18261e',
      bgInput: '#1f3027',
      bgHover: '#1c2b23',
      bgActive: '#24372d',
      bgUserpanel: '#0d1310',
      bgModal: '#18261e',
      bgMessageHover: '#152019',
      textNormal: '#dcebe2',
      textMuted: '#7f9c8b',
      textSecondary: '#aec7b9',
      textLink: '#00a8fc',
      danger: '#f23f43',
      online: '#3ba55d',
      idle: '#f0b232',
      dnd: '#f23f43',
      offline: '#80848e',
      divider: '#111b15'
    }
  },
  {
    id: 'ocean',
    name: 'Ocean',
    icon: '🌊',
    accent: '#00a8fc',
    palette: {
      bgRail: '#0d1620',
      bgSidebar: '#142230',
      bgChat: '#182a3b',
      bgInput: '#1f3347',
      bgHover: '#1d3042',
      bgActive: '#263d52',
      bgUserpanel: '#0b121a',
      bgModal: '#182a3b',
      bgMessageHover: '#152536',
      textNormal: '#dceaf6',
      textMuted: '#7f9cb5',
      textSecondary: '#b0c7db',
      textLink: '#8ce8ff',
      danger: '#f23f43',
      online: '#3ba55d',
      idle: '#f0b232',
      dnd: '#f23f43',
      offline: '#80848e',
      divider: '#101d2a'
    }
  },
  {
    id: 'sunset',
    name: 'Sunset',
    icon: '🌇',
    accent: '#f0616d',
    palette: {
      bgRail: '#1c1210',
      bgSidebar: '#271816',
      bgChat: '#2e1b18',
      bgInput: '#3a231f',
      bgHover: '#36201c',
      bgActive: '#462923',
      bgUserpanel: '#170e0c',
      bgModal: '#2e1b18',
      bgMessageHover: '#291714',
      textNormal: '#f0e0da',
      textMuted: '#c29d94',
      textSecondary: '#dcc0b8',
      textLink: '#ffb3a0',
      danger: '#f23f43',
      online: '#3ba55d',
      idle: '#f0b232',
      dnd: '#f23f43',
      offline: '#80848e',
      divider: '#1f1310'
    }
  },
  {
    id: 'candy',
    name: 'Candy',
    icon: '🍬',
    accent: '#eb459e',
    palette: {
      bgRail: '#1d1118',
      bgSidebar: '#2a1622',
      bgChat: '#311a29',
      bgInput: '#3d2133',
      bgHover: '#38202e',
      bgActive: '#472a3c',
      bgUserpanel: '#170d13',
      bgModal: '#311a29',
      bgMessageHover: '#2c1725',
      textNormal: '#f3dfe8',
      textMuted: '#c996ab',
      textSecondary: '#e2bccb',
      textLink: '#ff9ad1',
      danger: '#f23f43',
      online: '#3ba55d',
      idle: '#f0b232',
      dnd: '#f23f43',
      offline: '#80848e',
      divider: '#211218'
    }
  }
]

export const ACCENTS = ['#5865f2', '#eb459e', '#f0616d', '#f0b232', '#23a55a', '#00a8fc', '#a06cd5', '#ed4245', '#3ba55d', '#ffffff']

export const GRADIENTS = [
  { id: 'blurple', colors: ['#5865f2', '#a06cd5'] },
  { id: 'sunset', colors: ['#f0616d', '#f0b232'] },
  { id: 'ocean', colors: ['#00a8fc', '#5865f2'] },
  { id: 'mint', colors: ['#23a55a', '#00c6a7'] },
  { id: 'candy', colors: ['#eb459e', '#f0616d'] },
  { id: 'solar', colors: ['#f0b232', '#ed4245'] },
  { id: 'sky', colors: ['#00a8fc', '#23a55a'] },
  { id: 'grape', colors: ['#a06cd5', '#eb459e'] }
]

export function gradientCss(id) {
  const g = GRADIENTS.find((x) => x.id === id)
  if (!g) return null
  return `linear-gradient(135deg, ${g.colors[0]}, ${g.colors[1]})`
}

export const BANNERS = [
  { id: 'blurple', css: 'linear-gradient(120deg, #5865f2, #a06cd5)' },
  { id: 'sunset', css: 'linear-gradient(120deg, #f0616d, #f0b232)' },
  { id: 'ocean', css: 'linear-gradient(120deg, #00a8fc, #5865f2)' },
  { id: 'mint', css: 'linear-gradient(120deg, #23a55a, #00c6a7)' },
  { id: 'candy', css: 'linear-gradient(120deg, #eb459e, #f0616d)' },
  { id: 'night', css: 'linear-gradient(120deg, #10131c, #5865f2)' },
  { id: 'gold', css: 'linear-gradient(120deg, #f0b232, #ed4245)' }
]

export function bannerCss(id) {
  const b = BANNERS.find((x) => x.id === id)
  return b ? b.css : null
}

export const EMOJI_AVATARS = [
  '🦄', '🐸', '🦊', '🐼', '🐨', '🦁', '🐙', '🦋', '🌸', '🌈',
  '🔥', '💎', '🎮', '🎧', '🎨', '🎤', '⚡', '🍕', '🍩', '🌮',
  '👾', '🤖', '😎', '🥷', '🧙', '🦸', '👑', '🚀', '🛸', '🏆',
  '🎯', '🧊', '🍀', '🌙', '☄️', '🫀', '🎃', '👻', '💀', '🤡',
  '🐝', '🦦', '🐳', '🦩', '🦜', '🐉', '🦖', '🧁', '🍜', '☕'
]

// Profile card themes — like Discord's profile effects. They recolor the whole
// profile popout (card background, name, default banner and a glow).
export const PROFILE_THEMES = [
  { id: 'classic', name: 'Classic', icon: '🎭' },
  { id: 'royal', name: 'Royal', icon: '💜', nameColor: '#d6c6ff', body: 'linear-gradient(170deg, #241040, #120820)', banner: 'linear-gradient(120deg, #6b46c1, #a06cd5)', glow: '#a06cd5' },
  { id: 'sunset', name: 'Sunset', icon: '🌇', nameColor: '#ffb4a2', body: 'linear-gradient(170deg, #3a1f18, #1c1210)', banner: 'linear-gradient(120deg, #f0616d, #f0b232)', glow: '#f0616d' },
  { id: 'ocean', name: 'Ocean', icon: '🌊', nameColor: '#9fd8ff', body: 'linear-gradient(170deg, #0e2a48, #081420)', banner: 'linear-gradient(120deg, #00a8fc, #5865f2)', glow: '#00a8fc' },
  { id: 'forest', name: 'Forest', icon: '🌲', nameColor: '#b8ffcf', body: 'linear-gradient(170deg, #143226, #0a1a12)', banner: 'linear-gradient(120deg, #23a55a, #00c6a7)', glow: '#23a55a' },
  { id: 'gold', name: 'Gold', icon: '👑', nameColor: '#ffd977', body: 'linear-gradient(170deg, #332a12, #171208)', banner: 'linear-gradient(120deg, #f0b232, #ed4245)', glow: '#f0b232' },
  { id: 'candy', name: 'Candy', icon: '🍬', nameColor: '#ffc9e6', body: 'linear-gradient(170deg, #3d1433, #1d0a19)', banner: 'linear-gradient(120deg, #eb459e, #f0616d)', glow: '#eb459e' },
  { id: 'neon', name: 'Neon', icon: '⚡', nameColor: '#b8b1ff', body: 'linear-gradient(170deg, #1c1140, #0e081f)', banner: 'linear-gradient(120deg, #5865f2, #eb459e)', glow: '#5865f2' },
  { id: 'ash', name: 'Ash', icon: '🪨', nameColor: '#e8e8e8', body: 'linear-gradient(170deg, #2b2d31, #141516)', banner: 'linear-gradient(120deg, #4e5058, #80848e)', glow: '#80848e' }
]

export function profileTheme(id) {
  return PROFILE_THEMES.find((t) => t.id === id) || PROFILE_THEMES[0]
}

// Avatar decorations — emoji overlays stuck around the avatar, or CSS ring/aura effects.
export const DECORATIONS = [
  { id: 'crown', type: 'emoji', emoji: '👑', top: -7, right: -9, size: 18, rot: -18 },
  { id: 'headphones', type: 'emoji', emoji: '🎧', bottom: -5, left: -7, size: 17, rot: 12 },
  { id: 'sparkle', type: 'emoji', emoji: '✨', top: -9, right: -5, size: 14, spin: true },
  { id: 'flame', type: 'emoji', emoji: '🔥', bottom: -5, right: -5, size: 16, rot: 8 },
  { id: 'star', type: 'emoji', emoji: '⭐', top: -8, left: -8, size: 15 },
  { id: 'bubbles', type: 'emoji', emoji: '🫧', top: -10, right: -7, size: 13 },
  { id: 'rocket', type: 'emoji', emoji: '🚀', top: -10, left: -7, size: 16, rot: -20 },
  { id: 'heart', type: 'emoji', emoji: '💖', bottom: -6, right: -7, size: 13 },
  { id: 'ring', type: 'ring', name: 'Ring' },
  { id: 'dualring', type: 'ring', name: 'Double Ring' },
  { id: 'aura', type: 'aura', name: 'Aura' }
]

export function decorationById(id) {
  return DECORATIONS.find((d) => d.id === id) || null
}

export const CHAT_BGS = [
  { id: 'default', name: 'Default', css: 'none' },
  { id: 'aurora', name: 'Aurora', css: 'linear-gradient(180deg, rgba(88,101,242,0.18), rgba(35,165,90,0.10))' },
  { id: 'ocean', name: 'Ocean', css: 'linear-gradient(180deg, rgba(0,168,252,0.18), rgba(23,55,200,0.14))' },
  { id: 'sunset', name: 'Sunset', css: 'linear-gradient(180deg, rgba(240,98,146,0.18), rgba(240,178,50,0.12))' },
  { id: 'neon', name: 'Neon', css: 'linear-gradient(180deg, rgba(88,101,242,0.14), rgba(235,69,158,0.12))' }
]

export function chatBgCss(id) {
  const b = CHAT_BGS.find((x) => x.id === id)
  return b ? b.css : 'none'
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function darken(hex, amount = 0.14) {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const f = (v) => Math.max(0, Math.round(v * (1 - amount)))
  return `rgb(${f(rgb.r)}, ${f(rgb.g)}, ${f(rgb.b)})`
}

export function readableOn(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#ffffff'
  const l = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b
  return l > 170 ? '#1a1b1e' : '#ffffff'
}

export function getSettings() {
  const themeId = readCfg('theme', 'dark')
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0]
  let accent = readCfg('accent', '')
  if (!accent || !hexToRgb(accent)) accent = theme.accent
  return {
    theme,
    accent,
    density: readCfg('density', 'cozy'),
    fontScale: (parseFloat(readCfg('font', '14')) || 14) / 14,
    chatBg: readCfg('chatbg', 'default'),
    motion: readCfg('motion', 'normal')
  }
}

export function applyAppSettings() {
  if (typeof document === 'undefined') return
  const s = getSettings()
  const root = document.documentElement
  root.dataset.theme = s.theme.id
  root.dataset.density = s.density
  root.dataset.motion = s.motion === 'reduced' ? 'reduced' : 'normal'

  if (readCfg('privacy_blur', '0') === '1') root.dataset.privacyBlur = '1'
  else delete root.dataset.privacyBlur

  const vars = { ...s.theme.palette }
  const cssVars = {}
  for (const [k, v] of Object.entries(vars)) cssVars[`--${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`] = v
  cssVars['--accent'] = s.accent
  cssVars['--accent-hover'] = darken(s.accent)
  cssVars['--font-scale'] = String(s.fontScale)
  cssVars['--chat-bg-image'] = chatBgCss(s.chatBg)

  for (const [k, v] of Object.entries(cssVars)) root.style.setProperty(k, v)
}

export function resetAppearance() {
  for (const key of ['theme', 'accent', 'density', 'font', 'chatbg', 'motion']) {
    try { localStorage.removeItem(CFG_PREFIX + key) } catch { /* noop */ }
  }
  applyAppSettings()
}

import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar.jsx'
import AccountSettings from './AccountSettings.jsx'
import { api } from '../api.js'
import {
  UserIcon,
  ImageIcon,
  LockIcon,
  PuzzleIcon,
  LinkIcon,
  BellIcon,
  MicIcon,
  PaletteIcon,
  GlobeIcon
} from '../icons.jsx'
import {
  THEMES,
  ACCENTS,
  GRADIENTS,
  gradientCss,
  BANNERS,
  bannerCss,
  CHAT_BGS,
  PROFILE_THEMES,
  DECORATIONS,
  getSettings,
  applyAppSettings,
  readCfg,
  writeCfg,
  resetAppearance
} from '../themes.js'

const NAV = [
  { group: 'USER SETTINGS', items: [
    ['account', 'My Account', UserIcon],
    ['profile', 'User Profile', ImageIcon],
    ['privacy', 'Privacy & Safety', LockIcon],
    ['apps', 'Authorized Apps', PuzzleIcon],
    ['connections', 'Connections', LinkIcon]
  ] },
  { group: 'APP SETTINGS', items: [
    ['notifications', 'Notifications', BellIcon],
    ['voice', 'Voice & Video', MicIcon],
    ['appearance', 'Appearance', PaletteIcon],
    ['language', 'Language', GlobeIcon]
  ] }
]

export default function SettingsModal({ me, onClose, onLogout, onUpdateProfile, initialTab = 'appearance' }) {
  const [tab, setTab] = useState(initialTab)
  return (
    <div className="settings-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal wide">
        <div className="settings-side">
          {NAV.map(({ group, items }) => (
            <div key={group}>
              <div className="settings-side-title">{group}</div>
              {items.map(([id, label, Icon]) => (
                <button key={id} className={`settings-nav ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
                  <span className="settings-nav-icon"><Icon size={16} /></span>
                  <span className="settings-nav-label">{label}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="settings-spacer" />
          <button className="settings-nav danger" onClick={onLogout}>Log Out</button>
        </div>
        <div className="settings-main">
          {tab === 'account' && <AccountSettings me={me} onUpdateProfile={onUpdateProfile} onNavigate={() => setTab('profile')} />}
          {tab === 'profile' && <ProfileTab me={me} onUpdateProfile={onUpdateProfile} />}
          {tab === 'privacy' && <PrivacyTab />}
          {tab === 'apps' && <AppsTab />}
          {tab === 'connections' && <ConnectionsTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'voice' && <VoiceVideoTab />}
          {tab === 'appearance' && <AppearanceTab onClose={onClose} />}
          {tab === 'language' && <LanguageTab />}
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return <div className="settings-section-title">{children}</div>
}

function ToggleRow({ label, hint, on, onChange }) {
  return (
    <div className="toggle-row" onClick={() => onChange(!on)}>
      <div className="toggle-label">
        <span>{label}</span>
        {hint && <span className="settings-hint">{hint}</span>}
      </div>
      <span className={`toggle ${on ? 'on' : ''}`}><span /></span>
    </div>
  )
}

/* ------------------------------ User Profile ------------------------------ */

function ProfileTab({ me, onUpdateProfile }) {
  const [color, setColor] = useState(me.color || '#5865f2')
  const [gradient, setGradient] = useState(me.gradient || null)
  const [banner, setBanner] = useState(me.banner || null)
  const [bio, setBio] = useState(me.bio || '')
  const [pronoun, setPronoun] = useState(me.pronoun || '')
  const [profileThemeId, setProfileThemeId] = useState(me.profileTheme || 'classic')
  const [decoration, setDecoration] = useState(me.decoration || null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const preview = {
    ...me,
    color,
    gradient,
    banner,
    bio,
    pronoun,
    profileTheme: profileThemeId,
    decoration
  }

  const save = async () => {
    setError('')
    setSaved(false)
    setBusy(true)
    try {
      const { user } = await api('/me', {
        method: 'PATCH',
        body: {
          color,
          gradient,
          banner,
          bio,
          pronoun,
          profileTheme: profileThemeId === 'classic' ? null : profileThemeId,
          decoration
        }
      })
      onUpdateProfile(user)
      setSaved(true)
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-scroll">
      <h2>User Profile</h2>
      <p className="settings-hint">This is how people see your profile across the app.</p>

      <ProfileCardPreview user={preview} />

      <SectionTitle>Profile theme</SectionTitle>
      <div className="profile-theme-grid">
        {PROFILE_THEMES.map((t) => (
          <button
            key={t.id}
            className={`profile-theme-opt ${profileThemeId === t.id ? 'selected' : ''}`}
            style={t.body ? { background: t.body } : { background: 'var(--bg-input)' }}
            onClick={() => setProfileThemeId(t.id)}
          >
            <span className="profile-theme-icon">{t.icon}</span>
            <span>{t.name}</span>
            {t.nameColor && <span className="profile-theme-swatch" style={{ background: t.banner }} />}
          </button>
        ))}
      </div>

      <SectionTitle>Avatar background</SectionTitle>
      <div className="settings-field">
        <div className="gradient-grid">
          <button className={`gradient-option ${!gradient ? 'selected' : ''}`} style={{ background: color }} onClick={() => setGradient(null)} />
          {GRADIENTS.map((g) => (
            <button key={g.id} className={`gradient-option ${gradient === g.id ? 'selected' : ''}`} style={{ background: gradientCss(g.id) }} onClick={() => setGradient(g.id)} />
          ))}
        </div>
      </div>

      <div className="settings-field">
        <label>Name color</label>
        <div className="color-grid">
          {ACCENTS.map((c) => (
            <button key={c} className={`color-option ${color === c && !gradient ? 'selected' : ''}`} style={{ background: c === '#ffffff' ? '#dbdee1' : c }} onClick={() => { setColor(c); setGradient(null) }} />
          ))}
          <label className="custom-color mini" title="Custom color">
            <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setGradient(null) }} />
          </label>
        </div>
      </div>

      <SectionTitle>Banner</SectionTitle>
      <div className="settings-field">
        <div className="banner-grid">
          <button className={`banner-option ${!banner ? 'selected' : ''}`} onClick={() => setBanner(null)}>
            <span className="banner-swatch" style={{ background: 'var(--bg-input)' }} />
            <span>None</span>
          </button>
          {BANNERS.map((b) => (
            <button key={b.id} className={`banner-option ${banner === b.id ? 'selected' : ''}`} onClick={() => setBanner(b.id)}>
              <span className="banner-swatch" style={{ background: b.css }} />
              <span>{b.id}</span>
            </button>
          ))}
        </div>
      </div>

      <SectionTitle>Decoration</SectionTitle>
      <div className="deco-grid">
        <button className={`deco-opt ${!decoration ? 'selected' : ''}`} onClick={() => setDecoration(null)}>
          <span className="deco-none">✕</span>
          <span>None</span>
        </button>
        {DECORATIONS.map((d) => (
          <button key={d.id} className={`deco-opt ${decoration === d.id ? 'selected' : ''}`} onClick={() => setDecoration(d.id)}>
            <span className="deco-preview" style={{ color }}>{d.type === 'emoji' ? d.emoji : d.type === 'ring' ? '◎' : '◯'}</span>
            <span>{d.name || d.id}</span>
          </button>
        ))}
      </div>

      <div className="settings-field">
        <label>Pronoun</label>
        <input value={pronoun} onChange={(e) => setPronoun(e.target.value)} maxLength={32} placeholder="e.g. she/her" />
      </div>

      <div className="settings-field">
        <label>Bio</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} placeholder="Tell people about yourself..." />
        <span className="settings-count">{bio.length}/300</span>
      </div>

      {error && <div className="auth-error">{error}</div>}
      {saved && <div className="settings-saved">✓ Saved</div>}
      <button className="btn btn-primary" onClick={save} disabled={busy}>Save Changes</button>
    </div>
  )
}

function ProfileCardPreview({ user }) {
  const banner = bannerCss(user.banner) || (user.color ? `linear-gradient(120deg, ${user.color}, ${user.color}55)` : 'var(--accent)')
  return (
    <div className="profile-card-preview">
      <div className="profile-card-banner" style={{ background: banner }} />
      <div className="profile-card-body">
        <Avatar user={user} size={72} showStatus border="var(--bg-modal)" />
        <div className="profile-card-info">
          <div className="profile-card-name">{user.username}</div>
          {user.pronoun && <div className="profile-card-pronoun">{user.pronoun}</div>}
          {user.customStatus && <div className="profile-card-status">{user.customStatus}</div>}
        </div>
        {user.bio && <div className="profile-card-bio">{user.bio}</div>}
      </div>
    </div>
  )
}

/* ----------------------------- Privacy & Safety --------------------------- */

const PRIVACY_DEFAULTS = {
  privacy_dm_nonservers: '1',
  privacy_blur: '0',
  privacy_media_scan: '1',
  privacy_online: '1'
}

function PrivacyTab() {
  const [dm, setDm] = useState(readCfg('privacy_dm_nonservers', '1') === '1')
  const [blur, setBlur] = useState(readCfg('privacy_blur', '0') === '1')
  const [scan, setScan] = useState(readCfg('privacy_media_scan', '1') === '1')
  const [online, setOnline] = useState(readCfg('privacy_online', '1') === '1')

  const save = (key, val) => {
    writeCfg(key, val ? '1' : '0')
    applyAppSettings()
  }

  return (
    <div className="settings-scroll">
      <h2>Privacy & Safety</h2>
      <p className="settings-hint">Manage how people can interact with you.</p>

      <SectionTitle>Direct Messages</SectionTitle>
      <ToggleRow
        label="Allow direct messages from server members"
        hint="If off, people on shared servers you are not friends with cannot DM you."
        on={dm}
        onChange={(v) => { setDm(v); save('privacy_dm_nonservers', v) }}
      />
      <ToggleRow
        label="Allow others to see your online status"
        on={online}
        onChange={(v) => { setOnline(v); save('privacy_online', v) }}
      />

      <SectionTitle>Message Content</SectionTitle>
      <div className="settings-field">
        <label>Message content</label>
        <select className="settings-select" value={blur ? 'blur' : 'always'} onChange={(e) => { const v = e.target.value === 'blur'; setBlur(v); save('privacy_blur', v) }}>
          <option value="always">Always show content</option>
          <option value="blur">Blur content until hovered</option>
        </select>
      </div>

      <SectionTitle>Safety</SectionTitle>
      <ToggleRow
        label="Scan direct messages for malicious content"
        on={scan}
        onChange={(v) => { setScan(v); save('privacy_media_scan', v) }}
      />
      <p className="settings-hint" style={{ marginTop: 12 }}>Underground keeps your privacy settings stored locally in this browser.</p>
    </div>
  )
}

/* ---------------------------- Authorized Apps ----------------------------- */

const FAKE_APPS = [
  { id: 'spotify', icon: '🎧', name: 'Spotify', desc: 'See what you are listening to', scope: 'Presence' },
  { id: 'youtube', icon: '▶️', name: 'YouTube', desc: 'Play status and activity', scope: 'Presence' },
  { id: 'twitch', icon: '🎮', name: 'Twitch', desc: 'Streaming activity', scope: 'Presence' }
]

function AppsTab() {
  const [apps, setApps] = useState(FAKE_APPS)
  return (
    <div className="settings-scroll">
      <h2>Authorized Apps</h2>
      <p className="settings-hint">Apps you have connected to your account.</p>
      <div className="settings-list">
        {apps.length === 0 && <div className="settings-empty">No authorized apps.</div>}
        {apps.map((a) => (
          <div key={a.id} className="settings-list-item">
            <span className="settings-app-icon">{a.icon}</span>
            <div className="settings-app-info">
              <div className="settings-app-name">{a.name}</div>
              <div className="settings-app-desc">{a.desc} · {a.scope}</div>
            </div>
            <button className="btn btn-ghost btn-sm danger" onClick={() => setApps((l) => l.filter((x) => x.id !== a.id))}>Deauthorize</button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------- Connections ------------------------------ */

const CONNECTIONS = [
  { id: 'twitch', icon: '🟣', name: 'Twitch', color: '#9146ff' },
  { id: 'youtube', icon: '🔴', name: 'YouTube', color: '#ff0000' },
  { id: 'twitter', icon: '🐦', name: 'X (Twitter)', color: '#1da1f2' },
  { id: 'spotify', icon: '🟢', name: 'Spotify', color: '#1db954' },
  { id: 'steam', icon: '🔵', name: 'Steam', color: '#1b2838' },
  { id: 'github', icon: '⚫', name: 'GitHub', color: '#24292e' },
  { id: 'reddit', icon: '🟠', name: 'Reddit', color: '#ff4500' }
]

function ConnectionsTab() {
  const [connected, setConnected] = useState({})
  return (
    <div className="settings-scroll">
      <h2>Connections</h2>
      <p className="settings-hint">Connect your accounts to show off your activity.</p>
      <div className="settings-list">
        {CONNECTIONS.map((c) => {
          const on = !!connected[c.id]
          return (
            <div key={c.id} className="settings-list-item">
              <span className="settings-app-icon" style={{ background: c.color }}>{c.icon}</span>
              <div className="settings-app-info">
                <div className="settings-app-name">{c.name}</div>
                <div className="settings-app-desc">{on ? 'Connected' : 'Not connected'}</div>
              </div>
              <button className={`btn ${on ? 'btn-ghost' : 'btn-primary'} btn-sm`} onClick={() => setConnected((p) => ({ ...p, [c.id]: !on }))}>
                {on ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ----------------------------- Notifications ------------------------------ */

function NotificationsTab() {
  const [desktop, setDesktop] = useState(readCfg('notif_desktop', '0') === '1')
  const [soundMention, setSoundMention] = useState(readCfg('notif_sound_mention', '1') === '1')
  const [soundDm, setSoundDm] = useState(readCfg('notif_sound_dm', '1') === '1')
  const [badge, setBadge] = useState(readCfg('notif_badge', '1') === '1')

  const save = (key, val) => writeCfg(key, val ? '1' : '0')

  const enableDesktop = async () => {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    const on = perm === 'granted'
    setDesktop(on)
    save('notif_desktop', on)
  }

  return (
    <div className="settings-scroll">
      <h2>Notifications</h2>
      <p className="settings-hint">Choose when you get notified.</p>

      <SectionTitle>Desktop Notifications</SectionTitle>
      {!('Notification' in window) ? (
        <p className="settings-hint">Not supported in this browser.</p>
      ) : desktop ? (
        <ToggleRow label="Enable desktop notifications" hint="Notifications arrive when the window is hidden." on={desktop} onChange={() => { setDesktop(false); save('notif_desktop', false) }} />
      ) : (
        <div className="settings-field">
          <button className="btn btn-primary" onClick={enableDesktop}>Enable Desktop Notifications</button>
        </div>
      )}

      <SectionTitle>Sounds</SectionTitle>
      <ToggleRow label="Sound when you get a mention" on={soundMention} onChange={(v) => { setSoundMention(v); save('notif_sound_mention', v) }} />
      <ToggleRow label="Sound when you get a message in a DM" on={soundDm} onChange={(v) => { setSoundDm(v); save('notif_sound_dm', v) }} />

      <SectionTitle>Unread</SectionTitle>
      <ToggleRow label="Show unread indicators" on={badge} onChange={(v) => { setBadge(v); save('notif_badge', v) }} />
    </div>
  )
}

/* ----------------------------- Voice & Video ------------------------------ */

function VoiceVideoTab() {
  const [devices, setDevices] = useState({ input: [], output: [] })
  const [input, setInput] = useState(readCfg('audio_input', ''))
  const [output, setOutput] = useState(readCfg('audio_output', ''))
  const [sensitivity, setSensitivity] = useState(parseFloat(readCfg('audio_sensitivity', '0.25')))
  const [level, setLevel] = useState(0)
  const [testing, setTesting] = useState(false)
  const streamRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    navigator.mediaDevices.enumerateDevices().then((ds) => {
      const inputDevices = ds.filter((d) => d.kind === 'audioinput')
      const outputDevices = ds.filter((d) => d.kind === 'audiooutput')
      setDevices({ input: inputDevices, output: outputDevices })
    }).catch(() => { /* noop */ })
    return () => stop()
  }, [])

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    cancelAnimationFrame(rafRef.current)
    setTesting(false)
    setLevel(0)
  }

  const startTest = async () => {
    stop()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: input ? { exact: input } : undefined },
        video: false
      })
      streamRef.current = stream
      setTesting(true)
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += Math.abs(data[i] - 128) / 128
        setLevel(Math.min(1, sum / data.length * 4))
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch { /* permission denied */ }
  }

  return (
    <div className="settings-scroll">
      <h2>Voice & Video</h2>
      <p className="settings-hint">Configure your microphone and speakers.</p>

      <SectionTitle>Input Device</SectionTitle>
      <div className="settings-field">
        <label>Microphone</label>
        <select className="settings-select" value={input} onChange={(e) => { setInput(e.target.value); writeCfg('audio_input', e.target.value) }}>
          <option value="">Default</option>
          {devices.input.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 4)}`}</option>)}
        </select>
      </div>

      <div className="settings-field">
        <label>Input sensitivity</label>
        <input type="range" min={0} max={1} step={0.05} value={sensitivity}
          onChange={(e) => { const v = parseFloat(e.target.value); setSensitivity(v); writeCfg('audio_sensitivity', String(v)) }} />
        <span className="settings-hint">{sensitivity <= 0.15 ? 'Auto' : `${Math.round(sensitivity * 100)}%`}</span>
      </div>

      <div className="mic-test-row">
        <div className="mic-meter">
          <div className="mic-meter-fill" style={{ width: `${level * 100}%`, background: level > sensitivity ? 'var(--online)' : 'var(--accent)' }} />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={testing ? stop : startTest}>
          {testing ? 'Stop' : 'Test Microphone'}
        </button>
      </div>

      <SectionTitle>Output Device</SectionTitle>
      <div className="settings-field">
        <label>Speaker</label>
        <select className="settings-select" value={output} onChange={(e) => { setOutput(e.target.value); writeCfg('audio_output', e.target.value) }}>
          <option value="">Default</option>
          {devices.output.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0, 4)}`}</option>)}
        </select>
      </div>
    </div>
  )
}

/* -------------------------------- Appearance ------------------------------ */

function AppearanceTab({ onClose }) {
  const settings = getSettings()
  const [themeId, setThemeId] = useState(settings.theme.id)
  const [accent, setAccent] = useState(settings.accent)
  const [density, setDensity] = useState(settings.density)
  const [fontPx, setFontPx] = useState(Math.round(settings.fontScale * 14))
  const [chatBg, setChatBg] = useState(settings.chatBg)
  const [motion, setMotion] = useState(settings.motion)

  const apply = (key, value, setter) => {
    writeCfg(key, value)
    setter(value)
    applyAppSettings()
  }

  return (
    <div className="settings-scroll">
      <h2>Appearance</h2>
      <p className="settings-hint">All appearance changes apply instantly and are saved in your browser.</p>

      <SectionTitle>Theme</SectionTitle>
      <div className="theme-grid">
        {THEMES.map((t) => {
          const p = t.palette
          const active = t.id === themeId
          return (
            <button key={t.id} className={`theme-card ${active ? 'selected' : ''}`} onClick={() => apply('theme', t.id, setThemeId)}>
              <div className="theme-preview">
                <div className="theme-preview-rail" style={{ background: p.bgRail }} />
                <div className="theme-preview-side" style={{ background: p.bgSidebar }} />
                <div className="theme-preview-chat" style={{ background: p.bgChat }} />
                <span className="theme-preview-accent" style={{ background: t.accent }} />
              </div>
              <span className="theme-card-name">{t.icon} {t.name}</span>
            </button>
          )
        })}
      </div>

      <SectionTitle>Accent color</SectionTitle>
      <div className="settings-field">
        <div className="accent-row">
          <div className="accent-preview" style={{ background: accent }}>
            <span style={{ color: 'rgba(255,255,255,0.9)' }}>Aa</span>
          </div>
          <div className="color-grid">
            {ACCENTS.map((c) => (
              <button key={c} className={`color-option ${accent.toLowerCase() === c.toLowerCase() ? 'selected' : ''}`} style={{ background: c === '#ffffff' ? '#dbdee1' : c }} onClick={() => apply('accent', c, setAccent)} />
            ))}
          </div>
          <label className="custom-color">
            <input type="color" value={accent} onChange={(e) => apply('accent', e.target.value, setAccent)} />
            <span>Custom</span>
          </label>
        </div>
      </div>

      <SectionTitle>Message density</SectionTitle>
      <div className="segmented">
        <button className={density === 'cozy' ? 'active' : ''} onClick={() => apply('density', 'cozy', setDensity)}>🛋️ Cozy</button>
        <button className={density === 'compact' ? 'active' : ''} onClick={() => apply('density', 'compact', setDensity)}>📏 Compact</button>
      </div>

      <SectionTitle>Font size</SectionTitle>
      <div className="settings-field">
        <div className="font-row">
          <span className="font-sample small">Aa</span>
          <input type="range" min={12} max={20} step={1} value={fontPx}
            onChange={(e) => {
              const v = Number(e.target.value)
              setFontPx(v)
              writeCfg('font', v)
              applyAppSettings()
            }} />
          <span className="font-sample big">Aa</span>
          <span className="font-value">{fontPx}px</span>
        </div>
      </div>

      <SectionTitle>Chat background</SectionTitle>
      <div className="chatbg-grid">
        {CHAT_BGS.map((b) => (
          <button key={b.id} className={`chatbg-card ${chatBg === b.id ? 'selected' : ''}`} onClick={() => apply('chatbg', b.id, setChatBg)}>
            <span className="chatbg-swatch" style={{ background: b.css === 'none' ? 'var(--bg-chat)' : b.css }} />
            <span>{b.name}</span>
          </button>
        ))}
      </div>

      <SectionTitle>Accessibility</SectionTitle>
      <ToggleRow label="Reduce motion" on={motion === 'reduced'} onChange={(v) => apply('motion', v ? 'reduced' : 'normal', setMotion)} />

      <div className="settings-actions">
        <button className="btn btn-ghost" onClick={() => { resetAppearance(); setThemeId(getSettings().theme.id); setAccent(getSettings().accent); setDensity('cozy'); setFontPx(14); setChatBg('default'); setMotion('normal') }}>↺ Reset to defaults</button>
        <button className="btn btn-primary" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}

/* -------------------------------- Language -------------------------------- */

const LANGUAGES = ['English, US', 'English, UK', 'Deutsch', 'Français', 'Español', '日本語', '한국어', 'Português', 'Русский', '中文']

function LanguageTab() {
  const [lang, setLang] = useState(readCfg('language', 'English, US'))
  return (
    <div className="settings-scroll">
      <h2>Language</h2>
      <p className="settings-hint">Choose your preferred language.</p>
      <div className="settings-list">
        {LANGUAGES.map((l) => (
          <button key={l} className={`settings-list-item settings-lang ${lang === l ? 'active' : ''}`} onClick={() => { setLang(l); writeCfg('language', l) }}>
            <span>{l}</span>
            {lang === l && <span className="settings-lang-check">✓</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

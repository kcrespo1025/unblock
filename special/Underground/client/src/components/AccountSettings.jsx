import { useEffect, useState } from 'react'
import Avatar from './Avatar.jsx'
import QRCode from './QRCode.jsx'
import { api } from '../api.js'
import { pickMediaFile } from '../media.js'
import { UploadIcon, CloseIcon } from '../icons.jsx'
import { EMOJI_AVATARS } from '../themes.js'

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {})
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try { document.execCommand('copy') } catch { /* noop */ }
  document.body.removeChild(ta)
}

export default function AccountSettings({ me, onUpdateProfile, onNavigate }) {
  const [user, setUser] = useState(me)
  const [emailPanel, setEmailPanel] = useState(null)
  const [phonePanel, setPhonePanel] = useState(null)
  const [pwPanel, setPwPanel] = useState(false)
  const [avatarPanel, setAvatarPanel] = useState(false)
  const [namePanel, setNamePanel] = useState(false)

  useEffect(() => {
    api('/me').then(({ user }) => setUser(user)).catch(() => {})
  }, [])

  const applyUser = (u) => {
    setUser(u)
    if (onUpdateProfile) onUpdateProfile(u)
  }

  return (
    <div className="settings-scroll acct-scroll">
      <h2>My Account</h2>
      <p className="settings-hint">Manage your account, security and recovery options.</p>

      <div className="acct-card">
        <Avatar user={user} size={64} showStatus border="var(--bg-userpanel)" />
        <div className="acct-card-info">
          <div className="acct-card-name">{user.username}</div>
          <div className="acct-card-sub">{user.email || 'No email'}{user.emailVerified ? ' · verified ✓' : ''}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onNavigate}>Edit User Profile</button>
      </div>

      <div className="acct-rows">
        <AcctRow label="Avatar" desc="Set an emoji or upload an image / clip.">
          <button className="btn btn-ghost btn-sm" onClick={() => setAvatarPanel((v) => !v)}>{avatarPanel ? 'Done' : 'Change'}</button>
        </AcctRow>
        {avatarPanel && (
          <AvatarPanel me={user} onSaved={applyUser} />
        )}

        <AcctRow label="Username" desc="Your name shown across the app.">
          <button className="btn btn-ghost btn-sm" onClick={() => setNamePanel((v) => !v)}>{namePanel ? 'Done' : 'Edit'}</button>
        </AcctRow>
        {namePanel && (
          <NamePanel me={user} onSaved={applyUser} onDone={() => setNamePanel(false)} />
        )}

        <AcctRow label="Email" desc={user.emailVerified ? 'Verified. Used to log in and recover your account.' : 'Not verified yet.'}>
          <div className="acct-row-actions">
            {user.emailVerified ? (
              <span className="acct-badge ok">Verified</span>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={() => setEmailPanel('verify')}>Verify</button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setEmailPanel('change')}>Change</button>
          </div>
        </AcctRow>
        {emailPanel && (
          <EmailPanel me={user} mode={emailPanel} onSaved={applyUser} onDone={() => setEmailPanel(null)} />
        )}

        <AcctRow label="Phone number" desc={user.phoneMasked ? `Recovery line ${user.phoneMasked}` : 'Add a phone number for account recovery.'}>
          <div className="acct-row-actions">
            {!user.phoneMasked ? (
              <button className="btn btn-ghost btn-sm" onClick={() => setPhonePanel('add')}>Add</button>
            ) : (
              <>
                {!user.phoneVerified && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setPhonePanel('verify')}>Verify</button>
                )}
                <button className="btn btn-ghost btn-sm danger" onClick={() => setPhonePanel('remove')}>Remove</button>
              </>
            )}
          </div>
        </AcctRow>
        {phonePanel && (
          <PhonePanel me={user} mode={phonePanel} onSaved={applyUser} onDone={() => setPhonePanel(null)} />
        )}

        <AcctRow label="Password" desc="Change the password used to sign in.">
          <button className="btn btn-ghost btn-sm" onClick={() => setPwPanel((v) => !v)}>{pwPanel ? 'Done' : 'Change Password'}</button>
        </AcctRow>
        {pwPanel && (
          <PasswordPanel onSaved={applyUser} onDone={() => setPwPanel(false)} />
        )}
      </div>

      <TwoFactorSection me={user} onSaved={applyUser} />
    </div>
  )
}

/* ------------------------------ rows ------------------------------ */

function AcctRow({ label, desc, children }) {
  return (
    <div className="acct-row">
      <div className="acct-row-main">
        <div className="acct-row-label">{label}</div>
        <div className="acct-row-desc">{desc}</div>
      </div>
      <div className="acct-row-actions">{children}</div>
    </div>
  )
}

function SimCode({ code }) {
  if (!code) return null
  return (
    <div className="sim-code-box">
      <div className="sim-code-title">⚠️ Delivery is simulated — your code is:</div>
      <div className="sim-code-value">{code}</div>
    </div>
  )
}

function FlowError({ error }) {
  if (!error) return null
  return <div className="auth-error acct-error">{error}</div>
}

function FlowInput({ label, type = 'text', value, onChange, placeholder, maxLength }) {
  return (
    <div className="acct-flow-field">
      <label>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} />
    </div>
  )
}

function FlowActions({ busy, done, onCancel, submitLabel, okText }) {
  return (
    <div className="acct-flow-actions">
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => done()}>{busy ? 'Working…' : submitLabel}</button>
      <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      {okText && <span className="acct-badge ok">{okText}</span>}
    </div>
  )
}

/* ---------------------------- avatar panel ---------------------------- */

function AvatarPanel({ me, onSaved }) {
  const [avatar, setAvatar] = useState(me.avatar || '')
  const [avatarMedia, setAvatarMedia] = useState(me.avatarMedia || null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const upload = async () => {
    setError('')
    try {
      const media = await pickMediaFile({ maxDim: 512 })
      if (media) setAvatarMedia(media.dataUrl)
    } catch (err) {
      setError(err.message)
    }
  }

  const save = async () => {
    setError('')
    setDone(false)
    setBusy(true)
    try {
      const { user } = await api('/me', { method: 'PATCH', body: { avatar, avatarMedia } })
      onSaved(user)
      setDone(true)
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="acct-panel">
      <div className="emoji-avatar-grid">
        <button className={`emoji-choice ${!avatar ? 'selected' : ''}`} onClick={() => setAvatar('')} title="Show initials">ABC</button>
        {EMOJI_AVATARS.map((e) => (
          <button key={e} className={`emoji-choice ${avatar === e ? 'selected' : ''}`} onClick={() => setAvatar(e)}>{e}</button>
        ))}
      </div>
      <div className="acct-panel-row">
        <button className="btn btn-ghost btn-sm" onClick={upload} disabled={busy}><UploadIcon size={16} /> Upload Image / Clip</button>
        {avatarMedia && <button className="btn btn-ghost btn-sm" onClick={() => setAvatarMedia(null)}><CloseIcon size={14} /> Remove upload</button>}
        {avatarMedia && (
          <span className="acct-avatar-preview">
            <Avatar user={{ ...me, avatarMedia }} size={40} />
          </span>
        )}
      </div>
      <FlowError error={error} />
      <FlowActions busy={busy} done={save} onCancel={() => setAvatar('')} submitLabel="Save Avatar" okText={done ? 'Saved ✓' : ''} />
    </div>
  )
}

/* ----------------------------- name panel ----------------------------- */

function NamePanel({ me, onSaved, onDone }) {
  const [username, setUsername] = useState(me.username || '')
  const [customStatus, setCustomStatus] = useState(me.customStatus || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const save = async () => {
    setError('')
    setDone(false)
    setBusy(true)
    try {
      const { user } = await api('/me', {
        method: 'PATCH',
        body: { username: username.trim() || me.username, customStatus }
      })
      onSaved(user)
      setDone(true)
      onDone()
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="acct-panel">
      <FlowInput label="Username" value={username} onChange={setUsername} maxLength={32} />
      <FlowInput label="Custom status" value={customStatus} onChange={setCustomStatus} maxLength={128} placeholder="Set a custom status" />
      <FlowError error={error} />
      <FlowActions busy={busy} done={save} onCancel={onDone} submitLabel="Save Changes" okText={done ? 'Saved ✓' : ''} />
    </div>
  )
}

/* ----------------------------- email panel ----------------------------- */

function EmailPanel({ me, mode, onSaved, onDone }) {
  const [step, setStep] = useState(mode === 'change' ? 'request' : 'code')
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [simulatedCode, setSimulatedCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const title = mode === 'change' ? 'Change Email' : 'Verify Email'

  useEffect(() => {
    if (mode === 'verify') start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = async () => {
    setError('')
    setBusy(true)
    try {
      if (mode === 'change') {
        const res = await api('/me/email/change', { method: 'POST', body: { newEmail, password } })
        setSimulatedCode(res.simulatedCode)
        setStep('code')
      } else {
        const res = await api('/me/email/verify-send', { method: 'POST' })
        setSimulatedCode(res.simulatedCode)
        setStep('code')
      }
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    setError('')
    setDone(false)
    setBusy(true)
    try {
      const { user } = await api(mode === 'change' ? '/me/email/confirm' : '/me/email/verify', {
        method: 'POST',
        body: { code }
      })
      onSaved(user)
      setDone(true)
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="acct-panel">
      {step === 'request' ? (
        <>
          <FlowInput label="New email address" type="email" value={newEmail} onChange={setNewEmail} placeholder="you@example.com" />
          <FlowInput label="Current password" type="password" value={password} onChange={setPassword} placeholder="To confirm it's you" />
          <FlowError error={error} />
          <FlowActions busy={busy} done={start} onCancel={onDone} submitLabel="Send Verification Code" />
        </>
      ) : (
        <>
          <SimCode code={simulatedCode} />
          <FlowInput label={`Enter the 6-digit code sent to ${mode === 'change' ? newEmail : me.email}`} value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} placeholder="123456" maxLength={6} />
          <FlowError error={error} />
          <FlowActions busy={busy} done={confirm} onCancel={onDone} submitLabel={mode === 'change' ? 'Change Email' : 'Verify Email'} okText={done ? 'Done ✓' : ''} />
        </>
      )}
    </div>
  )
}

/* ----------------------------- phone panel ----------------------------- */

function PhonePanel({ me, mode, onSaved, onDone }) {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [simulatedCode, setSimulatedCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const send = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await api('/me/phone/send', { method: 'POST', body: { phone } })
      setSimulatedCode(res.simulatedCode)
      setDone(false)
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    setError('')
    setDone(false)
    setBusy(true)
    try {
      const { user } = await api('/me/phone/verify', { method: 'POST', body: { code } })
      onSaved(user)
      setDone(true)
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setError('')
    setDone(false)
    setBusy(true)
    try {
      const { user } = await api('/me/phone/remove', { method: 'POST', body: { password } })
      onSaved(user)
      setDone(true)
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="acct-panel">
      {mode === 'remove' ? (
        <>
          <p className="acct-panel-desc">Removing {me.phoneMasked} from your account.</p>
          <FlowInput label="Current password" type="password" value={password} onChange={setPassword} placeholder="To confirm it's you" />
          <FlowError error={error} />
          <FlowActions busy={busy} done={remove} onCancel={onDone} submitLabel="Remove Phone" okText={done ? 'Removed ✓' : ''} />
        </>
      ) : (
        <>
          {!simulatedCode ? (
            <>
              <FlowInput label="Phone number" type="tel" value={phone} onChange={setPhone} placeholder="+1 555 123 4567" maxLength={20} />
              <FlowError error={error} />
              <FlowActions busy={busy} done={send} onCancel={onDone} submitLabel="Send Code" />
            </>
          ) : (
            <>
              <SimCode code={simulatedCode} />
              <FlowInput label="Enter the 6-digit code" value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} placeholder="123456" maxLength={6} />
              <FlowError error={error} />
              <FlowActions busy={busy} done={verify} onCancel={onDone} submitLabel="Verify Phone" okText={done ? 'Verified ✓' : ''} />
            </>
          )}
        </>
      )}
    </div>
  )
}

/* ---------------------------- password panel ---------------------------- */

function PasswordPanel({ onSaved, onDone }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const save = async () => {
    setError('')
    if (next !== again) {
      setError('New passwords do not match')
      return
    }
    setDone(false)
    setBusy(true)
    try {
      await api('/me/password', { method: 'POST', body: { current, next } })
      setDone(true)
      setCurrent('')
      setNext('')
      setAgain('')
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="acct-panel">
      <FlowInput label="Current password" type="password" value={current} onChange={setCurrent} placeholder="Current password" />
      <FlowInput label="New password" type="password" value={next} onChange={setNext} placeholder="At least 6 characters" />
      <FlowInput label="Confirm new password" type="password" value={again} onChange={setAgain} placeholder="Repeat new password" />
      <FlowError error={error} />
      <FlowActions busy={busy} done={save} onCancel={onDone} submitLabel="Update Password" okText={done ? 'Updated ✓' : ''} />
    </div>
  )
}

/* ------------------------------ 2FA section ------------------------------ */

function TwoFactorSection({ me, onSaved }) {
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState(null)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [setup, setSetup] = useState(null)
  const [newCodes, setNewCodes] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const enabled = !!me.twoFactorEnabled

  const reset = () => {
    setStage(null)
    setPassword('')
    setCode('')
    setSetup(null)
    setNewCodes(null)
    setError('')
  }

  const startEnable = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await api('/2fa/enable', { method: 'POST', body: { password } })
      setSetup(res)
      setStage('scan')
      setPassword('')
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const confirmEnable = async () => {
    setError('')
    setBusy(true)
    try {
      const { user } = await api('/2fa/confirm', { method: 'POST', body: { code } })
      onSaved(user)
      reset()
      setOpen(false)
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setError('')
    setBusy(true)
    try {
      const { user } = await api('/2fa/disable', { method: 'POST', body: { password, code } })
      onSaved(user)
      reset()
      setOpen(false)
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const revealCodes = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await api('/2fa/codes', { method: 'POST', body: { password, code } })
      setNewCodes(res.backupCodes)
      setPassword('')
      setCode('')
    } catch (err) {
      if (err.auth) return
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="acct-section">
      <div className="acct-section-title">Two-Factor Authentication</div>
      <p className="settings-hint">Add an extra layer of security to your account using an authenticator app.</p>

      <div className="acct-row">
        <div className="acct-row-main">
          <div className="acct-row-label">Two-factor authentication</div>
          <div className="acct-row-desc">
            {enabled
              ? 'Requires a 6-digit code from your authenticator app when logging in.'
              : 'Scan a QR code with Google Authenticator or Authy to get started.'}
          </div>
        </div>
        <div className="acct-row-actions">
          <span className={`acct-badge ${enabled ? 'ok' : 'off'}`}>{enabled ? 'Enabled' : 'Disabled'}</span>
          {enabled ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => { setStage('codes'); setError('') }}>View Backup Codes</button>
              <button className="btn btn-ghost btn-sm danger" onClick={() => { setStage('disable'); setError('') }}>Disable</button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => { setOpen(true); setStage('pw'); setError('') }}>Enable 2FA</button>
          )}
        </div>
      </div>

      {open && stage === 'pw' && (
        <div className="acct-panel">
          <p className="acct-panel-desc">Enter your password to start securing your account.</p>
          <FlowInput label="Current password" type="password" value={password} onChange={setPassword} placeholder="To confirm it's you" />
          <FlowError error={error} />
          <FlowActions busy={busy} done={startEnable} onCancel={() => { setOpen(false); reset() }} submitLabel="Start Setup" />
        </div>
      )}

      {stage === 'scan' && setup && (
        <div className="acct-panel">
          <div className="acct-2fa-scan">
            <div className="acct-qr-wrap">
              <QRCode value={setup.uri} size={168} />
            </div>
            <div className="acct-2fa-manual">
              <div className="acct-section-sub">Scan with your authenticator app</div>
              <p className="acct-panel-desc">Open Google Authenticator or Authy and scan the QR code. You can also enter the secret manually:</p>
              <div className="acct-secret">
                <code>{setup.secret}</code>
                <button className="btn btn-ghost btn-sm" onClick={() => copyText(setup.secret)}>Copy</button>
              </div>
              <div className="acct-section-sub">Backup codes (save these once)</div>
              <div className="acct-codes">
                {setup.backupCodes.map((c, i) => (
                  <code key={i} className="acct-code">{c}</code>
                ))}
              </div>
            </div>
          </div>
          <FlowActions busy={false} done={() => { setStage('confirm'); setCode(''); setError('') }} onCancel={() => { setOpen(false); reset() }} submitLabel="I've Scanned It — Continue" />
        </div>
      )}

      {stage === 'confirm' && (
        <div className="acct-panel">
          <p className="acct-panel-desc">Enter the 6-digit code currently shown in your authenticator app to finish enabling 2FA.</p>
          <FlowInput label="Authenticator code" value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} placeholder="123456" maxLength={6} />
          <FlowError error={error} />
          <FlowActions busy={busy} done={confirmEnable} onCancel={() => { setOpen(false); reset() }} submitLabel="Enable Two-Factor Authentication" />
        </div>
      )}

      {stage === 'disable' && (
        <div className="acct-panel">
          <p className="acct-panel-desc">Disabling 2FA will remove your backup codes. Enter your password and a current code to continue.</p>
          <FlowInput label="Current password" type="password" value={password} onChange={setPassword} placeholder="To confirm it's you" />
          <FlowInput label="Authenticator code" value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} placeholder="123456" maxLength={6} />
          <FlowError error={error} />
          <FlowActions busy={busy} done={disable} onCancel={reset} submitLabel="Disable 2FA" />
        </div>
      )}

      {stage === 'codes' && (
        <div className="acct-panel">
          {newCodes ? (
            <>
              <div className="acct-section-sub">Your new backup codes</div>
              <div className="acct-codes">
                {newCodes.map((c, i) => (
                  <code key={i} className="acct-code">{c}</code>
                ))}
              </div>
              <p className="acct-panel-desc">These codes each work once. Store them somewhere safe — the old codes no longer work.</p>
              <div className="acct-flow-actions">
                <button className="btn btn-primary btn-sm" onClick={() => { setNewCodes(null); reset() }}>Done</button>
              </div>
            </>
          ) : (
            <>
              <p className="acct-panel-desc">Enter your password and a current authenticator code to generate a fresh set of backup codes.</p>
              <FlowInput label="Current password" type="password" value={password} onChange={setPassword} placeholder="To confirm it's you" />
              <FlowInput label="Authenticator code" value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} placeholder="123456" maxLength={6} />
              <FlowError error={error} />
              <FlowActions busy={busy} done={revealCodes} onCancel={reset} submitLabel="Reveal Backup Codes" />
            </>
          )}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { api } from '../api.js'

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [twoFa, setTwoFa] = useState(null) // { tempToken }
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api(`/${mode}`, { method: 'POST', body: form })
      if (data.needs2fa) {
        setTwoFa({ tempToken: data.token })
        return
      }
      onAuth(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const submit2fa = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api('/login/2fa', { method: 'POST', body: { token: twoFa.tempToken, code } })
      onAuth(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-backdrop">
      <div className="auth-card">
        {twoFa ? (
          <>
            <div className="brand">
              <div className="logo">🛡️</div>
              <h1>Two-Factor Check</h1>
              <p>Enter the 6-digit code from your authenticator app (or a backup code)</p>
            </div>
            <form onSubmit={submit2fa}>
              {error && <div className="auth-error">{error}</div>}
              <div className="form-field">
                <label>Code</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  autoFocus
                  inputMode="numeric"
                  maxLength={11}
                />
              </div>
              <button type="submit" className="auth-submit" disabled={loading || code.length === 0}>
                {loading ? 'Verifying…' : 'Verify'}
              </button>
            </form>
            <div className="auth-switch">
              <button onClick={() => { setTwoFa(null); setCode(''); setError('') }}>← Back to login</button>
            </div>
          </>
        ) : (
          <>
            <div className="brand">
              <div className="logo">🕳️</div>
              <h1>Underground</h1>
              <p>Your place to talk with your friends</p>
            </div>

            <form onSubmit={submit}>
              {error && <div className="auth-error">{error}</div>}

              {mode === 'register' && (
                <div className="form-field">
                  <label>Username</label>
                  <input
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="Discord_User"
                    autoFocus
                  />
                </div>
              )}

              <div className="form-field">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  autoFocus={mode === 'login'}
                />
              </div>

              <div className="form-field">
                <label>Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Register'}
              </button>
            </form>

            <div className="auth-switch">
              {mode === 'login' ? (
                <>
                  Need an account?{' '}
                  <button onClick={() => { setMode('register'); setError('') }}>Register</button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button onClick={() => { setMode('login'); setError('') }}>Log In</button>
                </>
              )}
            </div>

            <div className="auth-hint">
              Sign in with your own account, or <button onClick={() => { setMode('register'); setError('') }}>register</button> to create one.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

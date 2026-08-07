import { useState } from 'react'
import Modal from './Modal.jsx'
import { api } from '../api.js'

export default function JoinServerModal({ onClose, onJoined }) {
  const [code, setCode] = useState('')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const lookup = async () => {
    setError('')
    setPreview(null)
    const c = code.trim()
    if (!c) return
    setBusy(true)
    try {
      const inv = await api(`/invites/${encodeURIComponent(c)}`)
      setPreview(inv)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const join = async () => {
    setBusy(true)
    try {
      const { serverId } = await api(`/invites/${encodeURIComponent(code.trim())}/join`, { method: 'POST' })
      await onJoined(serverId)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Join a Server"
      subtitle="Paste an invite code below"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={join} disabled={!preview || busy}>
            Join Server
          </button>
        </>
      }
    >
      <div className="join-row">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Invite code"
          autoFocus
          maxLength={32}
        />
        <button className="btn btn-primary" onClick={lookup} disabled={busy || !code.trim()}>Find</button>
      </div>
      {error && <div className="auth-error">{error}</div>}
      {preview && (
        <div className="invite-preview">
          <span className="invite-icon">{preview.icon}</span>
          <div>
            <div className="invite-name">{preview.serverName}</div>
            <div className="invite-meta">{preview.members} Members</div>
          </div>
          <span className="invite-join">Join</span>
        </div>
      )}
    </Modal>
  )
}

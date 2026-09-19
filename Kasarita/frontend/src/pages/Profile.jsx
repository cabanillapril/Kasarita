import React, { useState } from 'react'
import { useApp } from '../context/store.jsx'

export default function Profile() {
  const { currentUser, updateProfile, showToast, state, clearUserData } = useApp()
  const [name, setName] = useState(currentUser.name)
  const [email, setEmail] = useState(currentUser.email)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const dev = state.device

  function submit(e) {
    e.preventDefault()
    const result = updateProfile({ name, email, password: password || undefined })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError('')
    setPassword('')
    showToast('Profile updated.')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Profile</h1>
          <div className="page-sub">Manage your account and paired device.</div>
        </div>
      </div>
      <div className="profile-grid">
        <div className="panel">
          <h3>Account</h3>
          <form className="authform" onSubmit={submit}>
            <label>
              Full name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              New password <span style={{ fontWeight: 400 }}>(leave blank to keep current)</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} placeholder="••••••••" />
            </label>
            <div className="form-error">{error}</div>
            <button type="submit" className="btn btn-primary">
              Save changes
            </button>
          </form>
        </div>
        <div className="panel">
          <h3>Paired device</h3>
          <div className="task-meta" style={{ marginBottom: 10 }}>
            Kasarita ESP32-S3 · Device ID: KST-{currentUser.id.slice(0, 6).toUpperCase()}
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 14px 0' }}>
            Status: {dev.connected ? 'Connected and syncing in real time.' : 'Offline — reconnect from the sidebar.'}
          </p>
          <button
            className="btn btn-ghost"
            onClick={() => {
              clearUserData()
              showToast('Your tasks and schedule were cleared.')
            }}
          >
            Clear my task &amp; schedule data
          </button>
        </div>
      </div>
    </>
  )
}

import React, { useState } from 'react'
import { useApp } from '../context/store.jsx'
import {
  Settings as SettingsIcon, User, Bell, Wifi, Cpu, Moon, Volume2,
  Key, Shield, Trash2, RefreshCw, ExternalLink, CheckCircle2,
  BookOpen, Pencil, Plus, Check, X
} from 'lucide-react'
import { DEFAULT_SUBJECT_NAMES } from '../subjectConfig.js'


const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function Section({ title, icon, children }) {
  return (
    <div className="glass-card settings-section">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem', fontSize: '1.05rem' }}>
        <span style={{ color: 'var(--accent-violet)' }}>{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  )
}

function SettingRow({ label, desc, children }) {
  return (
    <div className="setting-row">
      <div>
        <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{label}</div>
        {desc && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{desc}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange, id }) {
  return (
    <label className="toggle-switch" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  )
}

export default function Settings() {
  const { currentUser, state, userData, logout, showToast, theme, setTheme, updateSubjects } = useApp()
  const [deviceStatus, setDeviceStatus] = useState(state?.device || { connected: false })
  const [checking, setChecking] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [editingSubject, setEditingSubject] = useState(null)
  const [subjectDraft, setSubjectDraft] = useState('')

  // Local preferences state
  const [prefs, setPrefs] = useState({
    soundEnabled: true,
    notifications: true,
    autoSync: true,
    xpAnimations: true,
    compactView: false
  })

  const user = currentUser || { name: 'Student', email: 'student@email.com' }
  const subjects = Array.isArray(userData?.gamification?.subjects) && userData.gamification.subjects.length > 0
    ? userData.gamification.subjects
    : DEFAULT_SUBJECT_NAMES

  function setPref(key, val) {
    setPrefs((p) => ({ ...p, [key]: val }))
  }

  function addSubject(event) {
    event.preventDefault()
    const name = newSubject.trim()
    if (!name) return
    if (subjects.some((subject) => subject.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      showToast('A subject with that name already exists.')
      return
    }
    if (updateSubjects([...subjects, name])) {
      setNewSubject('')
      showToast(`Added subject: ${name}`)
    }
  }

  function saveSubjectEdit(event, oldName) {
    event.preventDefault()
    const name = subjectDraft.trim()
    if (!name) {
      showToast('Subject name cannot be empty.')
      return
    }
    if (subjects.some((subject) => subject !== oldName && subject.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      showToast('A subject with that name already exists.')
      return
    }
    if (updateSubjects(subjects.map((subject) => subject === oldName ? name : subject), { [oldName]: name })) {
      setEditingSubject(null)
      setSubjectDraft('')
      showToast(`Renamed ${oldName} to ${name}. Study history was kept.`)
    }
  }

  function removeSubject(name) {
    if (subjects.length === 1) {
      showToast('Keep at least one subject in your focus list.')
      return
    }
    if (updateSubjects(subjects.filter((subject) => subject !== name))) {
      showToast(`${name} removed from focus choices. Study history remains in Progress.`)
    }
  }

  async function checkBackendConnection() {
    setChecking(true)
    try {
      const res = await fetch(`${API_BASE}/tasks`, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        showToast('✅ Backend connected successfully!')
        setDeviceStatus((d) => ({ ...d, backendOk: true }))
      } else {
        showToast('⚠️ Backend responded with an error.')
      }
    } catch {
      showToast('❌ Cannot reach backend. Check that it is running.')
    } finally {
      setChecking(false)
    }
  }

  async function checkDeviceConnection() {
    setChecking(true)
    try {
      const res = await fetch(`${API_BASE}/device/status`, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const data = await res.json()
        setDeviceStatus((d) => ({ ...d, connected: data.connected }))
        showToast(data.connected ? '✅ ESP32 device online!' : '📡 ESP32 device not detected.')
      } else {
        showToast('⚠️ Could not reach device status endpoint.')
      }
    } catch {
      showToast('📡 Device status endpoint not available yet.')
    } finally {
      setChecking(false)
    }
  }

  function clearAllData() {
    if (!window.confirm('This will clear all local data including tasks, messages, and XP. Are you sure?')) return
    localStorage.clear()
    window.location.reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div className="page-title-group">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <SettingsIcon color="var(--accent-violet)" /> Settings
          </h1>
          <p className="page-subtitle">Manage your profile, preferences, and device connections.</p>
        </div>
      </div>

      {/* Profile Section */}
      <Section title="Student Profile" icon={<User size={18} />}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="user-avatar" style={{ width: '64px', height: '64px', fontSize: '1.6rem', borderRadius: '50%', background: 'var(--gradient-xp)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800' }}>
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '1.2rem' }}>{user.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{user.email}</div>
            <div style={{ color: 'var(--accent-amber)', fontSize: '0.8rem', fontWeight: '600', marginTop: '0.2rem' }}>🎓 Student Account</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-ghost" id="edit-profile-btn" style={{ fontSize: '0.85rem' }}>
            <User size={14} /> Edit Profile
          </button>
          <button className="btn btn-ghost" id="logout-btn" onClick={logout} style={{ fontSize: '0.85rem', color: 'var(--accent-rose)' }}>
            Sign Out
          </button>
        </div>
      </Section>

      <div className="grid-2">
        {/* Preferences */}
        <Section title="App Preferences" icon={<Moon size={18} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0rem' }}>
            <SettingRow label="Dark Mode" desc="Use a darker color palette">
              <Toggle id="dark-mode-toggle" checked={theme === 'dark'} onChange={(enabled) => setTheme(enabled ? 'dark' : 'light')} />
            </SettingRow>
            <SettingRow label="Sound Effects" desc="XP and completion chimes">
              <Toggle id="sound-toggle" checked={prefs.soundEnabled} onChange={(v) => setPref('soundEnabled', v)} />
            </SettingRow>
            <SettingRow label="Notifications" desc="Task reminders and alerts">
              <Toggle id="notif-toggle" checked={prefs.notifications} onChange={(v) => setPref('notifications', v)} />
            </SettingRow>
            <SettingRow label="Auto-sync Tasks" desc="Sync tasks with backend on load">
              <Toggle id="sync-toggle" checked={prefs.autoSync} onChange={(v) => setPref('autoSync', v)} />
            </SettingRow>
            <SettingRow label="XP Animations" desc="Level up and XP visual effects">
              <Toggle id="xp-anim-toggle" checked={prefs.xpAnimations} onChange={(v) => setPref('xpAnimations', v)} />
            </SettingRow>
            <SettingRow label="Compact View" desc="Denser task list layout">
              <Toggle id="compact-toggle" checked={prefs.compactView} onChange={(v) => setPref('compactView', v)} />
            </SettingRow>
          </div>
        </Section>

        {/* Notifications */}
        <Section title="Notifications & Audio" icon={<Bell size={18} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0rem' }}>
            <SettingRow label="Task Due Reminders" desc="Notify 1 hour before due date">
              <Toggle id="remind-task-toggle" checked={true} onChange={() => {}} />
            </SettingRow>
            <SettingRow label="Study Session Alerts" desc="Session start and end chimes">
              <Toggle id="remind-study-toggle" checked={true} onChange={() => {}} />
            </SettingRow>
            <SettingRow label="XP Level Up" desc="Celebrate when you reach a new level">
              <Toggle id="remind-xp-toggle" checked={true} onChange={() => {}} />
            </SettingRow>
            <SettingRow label="Voice Volume" desc="TTS response volume">
              <select className="filter-select" id="volume-select" defaultValue="medium" style={{ width: '110px' }}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </SettingRow>
          </div>
        </Section>
      </div>

      <Section title="Study Subjects" icon={<BookOpen size={18} />}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
          These subjects appear in Study Focus. Renaming a subject keeps its study history; removing one only hides it from new sessions.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {subjects.map((subject) => (
            <div key={subject} className="setting-row" style={{ gap: '0.75rem' }}>
              {editingSubject === subject ? (
                <form
                  onSubmit={(event) => saveSubjectEdit(event, subject)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}
                >
                  <input
                    className="chat-input"
                    aria-label={`Rename ${subject}`}
                    value={subjectDraft}
                    onChange={(event) => setSubjectDraft(event.target.value)}
                    autoFocus
                    maxLength={40}
                  />
                  <button className="btn btn-ghost" type="submit" aria-label="Save subject name" title="Save">
                    <Check size={16} />
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    aria-label="Cancel subject rename"
                    title="Cancel"
                    onClick={() => setEditingSubject(null)}
                  >
                    <X size={16} />
                  </button>
                </form>
              ) : (
                <>
                  <div style={{ fontWeight: '600', flex: 1 }}>{subject}</div>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    aria-label={`Edit ${subject}`}
                    title={`Edit ${subject}`}
                    onClick={() => {
                      setEditingSubject(subject)
                      setSubjectDraft(subject)
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    aria-label={`Remove ${subject}`}
                    title={`Remove ${subject}`}
                    disabled={subjects.length === 1}
                    onClick={() => removeSubject(subject)}
                    style={{ color: 'var(--accent-rose)' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={addSubject} style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <input
            className="chat-input"
            aria-label="New subject name"
            placeholder="Add a subject"
            value={newSubject}
            onChange={(event) => setNewSubject(event.target.value)}
            maxLength={40}
          />
          <button className="btn btn-primary" type="submit" disabled={!newSubject.trim()}>
            <Plus size={16} /> Add
          </button>
        </form>
      </Section>

      <div className="grid-2">
        {/* Backend Connection */}
        <Section title="Backend & API" icon={<Wifi size={18} />}>
          <div style={{ padding: '1rem', background: 'rgba(15,23,42,0.5)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Backend URL</div>
              <a href={API_BASE} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <ExternalLink size={12} /> Open
              </a>
            </div>
            <div style={{ fontWeight: '600', fontSize: '0.9rem', marginTop: '0.25rem', fontFamily: 'monospace', color: 'var(--accent-violet)' }}>
              {API_BASE}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              id="check-backend-btn"
              className="btn btn-ghost"
              onClick={checkBackendConnection}
              disabled={checking}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {checking ? <RefreshCw size={16} className="spin" /> : <CheckCircle2 size={16} />}
              Test Backend Connection
            </button>
            <button
              id="check-device-btn"
              className="btn btn-ghost"
              onClick={checkDeviceConnection}
              disabled={checking}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Cpu size={16} /> Test ESP32 Device Status
            </button>
          </div>
        </Section>

        {/* Danger Zone */}
        <Section title="Data & Privacy" icon={<Shield size={18} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ padding: '0.85rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Your information is securely protected.
            </div>
            <button
              id="export-data-btn"
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem' }}
              onClick={() => {
                const data = localStorage.getItem('kasarita_state_v3') || '{}'
                const blob = new Blob([data], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'kasarita_backup.json'
                a.click()
                URL.revokeObjectURL(url)
                showToast('Data exported successfully!')
              }}
            >
              Export My Data (JSON)
            </button>
            <button
              id="clear-data-btn"
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem', color: 'var(--accent-rose)', borderColor: 'rgba(244,63,94,0.25)' }}
              onClick={clearAllData}
            >
              <Trash2 size={14} /> Clear All Local Data
            </button>
          </div>
        </Section>
      </div>

      {/* About Card */}
      <div className="glass-card" style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎓</div>
        <div style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.25rem' }}>Kasarita v1.0</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          MCP-enabled ESP32-S3 voice-driven student productivity system.
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          <span>ESP32-S3 Firmware</span>
          <span>·</span>
          <span>FastAPI Backend</span>
          <span>·</span>
          <span>Groq AI</span>
          <span>·</span>
          <span>React Frontend</span>
        </div>
      </div>
    </div>
  )
}

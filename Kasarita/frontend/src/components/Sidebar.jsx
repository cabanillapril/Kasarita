import React from 'react'
import { LayoutDashboard, MessageSquare, CheckSquare, Timer, Award, Settings, LogOut, Bot, X } from 'lucide-react'
import { useApp } from '../context/store.jsx'

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'chat', label: 'AI Companion', icon: MessageSquare },
  { key: 'tasks', label: 'Tasks', icon: CheckSquare },
  { key: 'study', label: 'Study Focus', icon: Timer },
  { key: 'progress', label: 'Progress', icon: Award },
  { key: 'settings', label: 'Settings', icon: Settings }
]

export default function Sidebar({ open, onClose }) {
  const { route, setRoute, currentUser, level, userData, logout } = useApp()

  const streak = userData?.gamification?.streak || 6
  const initials = (currentUser?.name || 'S')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  function handleNav(key) {
    setRoute(key)
    if (onClose) onClose()
  }

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="brand-logo" onClick={() => handleNav('dashboard')} style={{ cursor: 'pointer', margin: 0, padding: 0 }}>
          <div className="logo-icon">
            <Bot size={22} />
          </div>
          <div>
            <div className="brand-title">Kasarita</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Voice Companion
            </div>
          </div>
        </div>
        {onClose && (
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close Sidebar">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="nav-menu">
        {NAV.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`nav-item ${route === key ? 'active' : ''}`}
            onClick={() => handleNav(key)}
          >
            <Icon className="icon" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Streak Badge */}
      <div className="glass-card streak-card" style={{ padding: '0.85rem 1rem', marginBottom: '1rem', marginTop: '1rem' }}>
        <span className="flame-icon">🔥</span>
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--accent-amber)' }}>
            {streak} Day Streak!
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Keep studying daily</div>
        </div>
      </div>

      {/* User Info */}
      <div className="sidebar-user">
        <div className="user-avatar">{initials}</div>
        <div className="user-info">
          <div className="user-name">{currentUser?.name || 'Student'}</div>
          <div className="user-level-tag">Level {level} Student</div>
        </div>
        <button
          className="btn btn-ghost"
          style={{ padding: '0.4rem', borderRadius: '50%' }}
          onClick={logout}
          title="Sign Out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}

import React from 'react'
import { LayoutDashboard, CheckSquare, CalendarDays, Mic, BarChart3, UserRound, LogOut } from 'lucide-react'
import { useApp } from '../context/store.jsx'
import DeviceWidget from './DeviceWidget.jsx'

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'tasks', label: 'Tasks', icon: CheckSquare },
  { key: 'schedule', label: 'Schedule', icon: CalendarDays },
  { key: 'voice', label: 'Voice', icon: Mic },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'profile', label: 'Profile', icon: UserRound }
]

export default function Sidebar() {
  const { route, setRoute, currentUser, logout } = useApp()
  const initials = currentUser.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">Kasarita</span>
        <span className="brand-tag">student companion</span>
      </div>

      <nav className="side-nav">
        {NAV.map(({ key, label, icon: Icon }) => (
          <button key={key} className={route === key ? 'active' : ''} onClick={() => setRoute(key)}>
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <DeviceWidget />

      <div className="side-user">
        <div className="avatar">{initials}</div>
        <div className="side-user-info">
          <div className="side-user-name">{currentUser.name}</div>
          <div className="side-user-email">{currentUser.email}</div>
        </div>
        <button className="icon-btn" onClick={logout} aria-label="Sign out" title="Sign out">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}

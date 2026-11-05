import React, { useState } from 'react'
import { useApp } from './context/store.jsx'
import Sidebar from './components/Sidebar.jsx'
import Modal from './components/Modal.jsx'
import TaskForm from './components/TaskForm.jsx'
import EventForm from './components/EventForm.jsx'
import Auth from './pages/Auth.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Tasks from './pages/Tasks.jsx'
import Chat from './pages/Chat.jsx'
import Study from './pages/Study.jsx'
import Progress from './pages/Progress.jsx'
import Settings from './pages/Settings.jsx'
import { Menu, X, Bot } from 'lucide-react'

const PAGES = {
  dashboard: Dashboard,
  tasks: Tasks,
  chat: Chat,
  study: Study,
  progress: Progress,
  settings: Settings
}

export default function App() {
  const { currentUser, route, setRoute, modal, closeModal, toast } = useApp()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (!currentUser) return <Auth />

  const Page = PAGES[route] || Dashboard
  const initials = (currentUser?.name || 'S')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="app-shell">
      {/* Mobile / Tablet Responsive Topbar */}
      <header className="mobile-topbar">
        <button
          className="hamburger-btn"
          onClick={() => setSidebarOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
        >
          {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <div className="mobile-brand" onClick={() => setRoute('dashboard')}>
          <div className="logo-icon small">
            <Bot size={16} />
          </div>
          <span className="brand-title-sm">Kasarita</span>
        </div>

        <div className="mobile-user-badge" onClick={() => setRoute('settings')}>
          <div className="user-avatar-sm">{initials}</div>
        </div>
      </header>

      {/* Backdrop overlay for mobile drawer */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar Navigation */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <main className="main-content">
        <Page />
      </main>

      {modal.type === 'task' && (
        <Modal title={modal.payload ? 'Edit task' : 'New task'} onClose={closeModal}>
          <TaskForm existing={modal.payload} onDone={closeModal} />
        </Modal>
      )}
      {modal.type === 'event' && (
        <Modal title="New schedule entry" onClose={closeModal}>
          <EventForm onDone={closeModal} />
        </Modal>
      )}

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </div>
  )
}


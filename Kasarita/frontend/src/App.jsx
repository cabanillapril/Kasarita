import React from 'react'
import { useApp } from './context/store.jsx'
import Sidebar from './components/Sidebar.jsx'
import Modal from './components/Modal.jsx'
import TaskForm from './components/TaskForm.jsx'
import EventForm from './components/EventForm.jsx'
import Auth from './pages/Auth.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Tasks from './pages/Tasks.jsx'
import Schedule from './pages/Schedule.jsx'
import Voice from './pages/Voice.jsx'
import Analytics from './pages/Analytics.jsx'
import Profile from './pages/Profile.jsx'

const PAGES = {
  dashboard: Dashboard,
  tasks: Tasks,
  schedule: Schedule,
  voice: Voice,
  analytics: Analytics,
  profile: Profile
}

export default function App() {
  const { currentUser, route, modal, closeModal, toast } = useApp()

  if (!currentUser) return <Auth />

  const Page = PAGES[route] || Dashboard

  return (
    <div className="app-shell">
      <Sidebar />
      <main>
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

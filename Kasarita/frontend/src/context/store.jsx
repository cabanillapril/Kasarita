import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { uid, todayISO, fmtDate, cap, parseLooseDate, speak } from '../utils.js'

const STORAGE_KEY = 'kasarita_state_v2'
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const AppContext = createContext(null)

function fromApiTask(task) {
  return {
    id: task.id,
    title: task.title,
    category: task.category || 'General',
    priority: cap(task.priority || 'normal'),
    status: task.status === 'completed' ? 'Done' : 'To do',
    due: task.due_date || null,
    notes: task.notes || '',
    completedOn: task.status === 'completed' ? task.completed_on : undefined
  }
}

function sampleTasks() {
  return [
    { id: uid(), title: 'Finish CS elective proposal', category: 'Academics', priority: 'High', status: 'In progress', due: todayISO(), notes: '' },
    { id: uid(), title: 'Read Chapter 2 notes', category: 'Study', priority: 'Medium', status: 'To do', due: null, notes: '' },
    { id: uid(), title: 'Submit lab report', category: 'Academics', priority: 'Low', status: 'To do', due: null, notes: '' }
  ]
}
function sampleEvents() {
  const t = todayISO()
  return [
    { id: uid(), title: 'Software Engineering lecture', date: t, time: '09:00', type: 'Class' },
    { id: uid(), title: 'Study session — Data Structures', date: t, time: '19:00', type: 'Study' }
  ]
}

function defaultState() {
  return {
    users: [],
    currentUserId: null,
    data: {},
    device: { connected: true, wakeWord: false, lastSync: new Date().toISOString() }
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw)
    if (!parsed.data) parsed.data = {}
    if (!parsed.device) parsed.device = { connected: true, wakeWord: false, lastSync: new Date().toISOString() }
    return parsed
  } catch (e) {
    console.warn('Kasarita: could not read saved data, starting fresh.', e)
    return defaultState()
  }
}

export function AppProvider({ children }) {
  const [state, setState] = useState(loadState)
  const [route, setRoute] = useState('dashboard')
  const [modal, setModal] = useState({ type: null, payload: null })
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.warn('Kasarita: could not save data.', e)
    }
  }, [state])

  // Simulated real-time sync tick while the device is "connected".
  useEffect(() => {
    const id = setInterval(() => {
      setState((s) => (s.device.connected ? { ...s, device: { ...s.device, lastSync: new Date().toISOString() } } : s))
    }, 30000)
    return () => clearInterval(id)
  }, [])

  function showToast(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }

  const currentUser = state.users.find((u) => u.id === state.currentUserId) || null
  const userData = currentUser ? state.data[currentUser.id] || { tasks: [], events: [], voiceLog: [] } : null

  useEffect(() => {
    if (!currentUser) return
    fetch(`${API_BASE}/tasks`)
      .then((response) => {
        if (!response.ok) throw new Error(`Task API returned ${response.status}`)
        return response.json()
      })
      .then(({ tasks }) => {
        setState((s) => ({
          ...s,
          data: {
            ...s.data,
            [currentUser.id]: {
              ...(s.data[currentUser.id] || { events: [], voiceLog: [] }),
              tasks: tasks.map(fromApiTask)
            }
          }
        }))
      })
      .catch(() => showToast('Backend tasks unavailable; showing local tasks.'))
  }, [currentUser?.id])

  function mutateUserData(userId, fn) {
    setState((s) => {
      const existing = s.data[userId] || { tasks: [], events: [], voiceLog: [] }
      const next = fn({ tasks: [...existing.tasks], events: [...(existing.events || [])], voiceLog: [...(existing.voiceLog || [])] })
      return { ...s, data: { ...s.data, [userId]: next } }
    })
  }

  function register(name, email, password) {
    email = email.trim().toLowerCase()
    if (state.users.some((u) => u.email === email)) return { ok: false, error: 'An account with that email already exists.' }
    const newUser = { id: uid(), name: name.trim() || email.split('@')[0], email, password }
    setState((s) => ({
      ...s,
      users: [...s.users, newUser],
      data: { ...s.data, [newUser.id]: { tasks: sampleTasks(), events: sampleEvents(), voiceLog: [] } },
      currentUserId: newUser.id
    }))
    return { ok: true }
  }

  function login(email, password) {
    email = email.trim().toLowerCase()
    const found = state.users.find((u) => u.email === email && u.password === password)
    if (!found) return { ok: false, error: 'No account matches that email and password.' }
    setState((s) => ({ ...s, currentUserId: found.id }))
    return { ok: true }
  }

  function logout() {
    setState((s) => ({ ...s, currentUserId: null }))
    setRoute('dashboard')
  }

  function updateProfile(fields) {
    if (!currentUser) return { ok: false, error: 'Not signed in.' }
    const newEmail = (fields.email || currentUser.email).trim().toLowerCase()
    const clash = state.users.some((u) => u.email === newEmail && u.id !== currentUser.id)
    if (clash) return { ok: false, error: 'That email is already in use.' }
    setState((s) => ({
      ...s,
      users: s.users.map((u) =>
        u.id === currentUser.id
          ? { ...u, name: fields.name?.trim() || u.name, email: newEmail, password: fields.password ? fields.password : u.password }
          : u
      )
    }))
    return { ok: true }
  }

  function toggleDevice() {
    setState((s) => ({
      ...s,
      device: { ...s.device, connected: !s.device.connected, lastSync: !s.device.connected ? new Date().toISOString() : s.device.lastSync }
    }))
  }

  function addTask(task) {
    if (!currentUser) return
    const localId = uid()
    fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arguments: { title: task.title, due_date: task.due || null, priority: (task.priority || 'Medium').toLowerCase(), status: task.status === 'Done' ? 'completed' : 'pending' } })
    })
      .then((response) => response.json())
      .then((payload) => {
        if (payload.status === 'ok') {
          mutateUserData(currentUser.id, (d) => ({ ...d, tasks: [fromApiTask(payload.task), ...d.tasks.filter((item) => item.id !== localId)] }))
        }
      })
      .catch(() => showToast('Task saved locally; backend unavailable.'))
    mutateUserData(currentUser.id, (d) => {
      d.tasks = [{ id: localId, completedOn: task.status === 'Done' ? todayISO() : undefined, ...task }, ...d.tasks]
      return d
    })
  }
  function updateTask(id, fields) {
    if (!currentUser) return
    fetch(`${API_BASE}/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arguments: { ...(fields.title !== undefined ? { title: fields.title } : {}), ...(fields.due !== undefined ? { due_date: fields.due } : {}), ...(fields.priority !== undefined ? { priority: fields.priority.toLowerCase() } : {}), ...(fields.status !== undefined ? { status: fields.status === 'Done' ? 'completed' : 'pending' } : {}) } })
    }).catch(() => showToast('Task updated locally; backend unavailable.'))
    mutateUserData(currentUser.id, (d) => {
      d.tasks = d.tasks.map((t) => {
        if (t.id !== id) return t
        const next = { ...t, ...fields }
        if (t.status !== 'Done' && fields.status === 'Done') next.completedOn = todayISO()
        if (fields.status && fields.status !== 'Done') delete next.completedOn
        return next
      })
      return d
    })
  }
  function toggleTask(id) {
    if (!currentUser) return
    const existing = userData.tasks.find((task) => task.id === id)
    if (existing) updateTask(id, { status: existing.status === 'Done' ? 'To do' : 'Done' })
    mutateUserData(currentUser.id, (d) => {
      d.tasks = d.tasks.map((t) => {
        if (t.id !== id) return t
        if (t.status === 'Done') {
          const { completedOn, ...rest } = t
          return { ...rest, status: 'To do' }
        }
        return { ...t, status: 'Done', completedOn: todayISO() }
      })
      return d
    })
  }
  function deleteTask(id) {
    if (!currentUser) return
    fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' }).catch(() => showToast('Task removed locally; backend unavailable.'))
    mutateUserData(currentUser.id, (d) => {
      d.tasks = d.tasks.filter((t) => t.id !== id)
      return d
    })
  }

  function addEvent(evt) {
    if (!currentUser) return
    mutateUserData(currentUser.id, (d) => {
      d.events = [...d.events, { id: uid(), ...evt }]
      return d
    })
  }
  function deleteEvent(id) {
    if (!currentUser) return
    mutateUserData(currentUser.id, (d) => {
      d.events = d.events.filter((e) => e.id !== id)
      return d
    })
  }

  function clearUserData() {
    if (!currentUser) return
    setState((s) => ({ ...s, data: { ...s.data, [currentUser.id]: { tasks: [], events: [], voiceLog: [] } } }))
  }

  function sendVoiceCommand(rawText) {
    if (!currentUser) return
    const text = rawText.trim()
    if (!text) return
    const lower = text.toLowerCase()

    mutateUserData(currentUser.id, (d) => {
      d.voiceLog = [...d.voiceLog, { from: 'you', text, at: new Date().toISOString() }]

      let reply = ''
      const addMatch = lower.match(/^(add|create|new)\s+task\s+(.+)/i)
      const completeMatch = lower.match(/^(complete|finish|mark)\s+(?:task\s+)?(.+?)(\s+as\s+done|\s+done)?$/i)
      const scheduleMatch = /schedule|calendar|what's next|whats next|upcoming/.test(lower)
      const summaryMatch = /how many task|task summary|task count|status/.test(lower)
      const connectMatch = /connect device|reconnect|pair device/.test(lower)

      if (addMatch) {
        const rest = addMatch[2]
        const dueMatch = rest.match(/\bdue\s+(.+)$/i)
        let title = rest
        let due = null
        if (dueMatch) {
          title = rest.slice(0, dueMatch.index).trim()
          due = parseLooseDate(dueMatch[1])
        }
        if (title) {
          d.tasks = [{ id: uid(), title: cap(title), category: 'Voice', priority: 'Medium', status: 'To do', due, notes: '' }, ...d.tasks]
          reply = `Added "${cap(title)}" to your tasks${due ? `, due ${fmtDate(due)}` : ''}.`
        } else {
          reply = 'I heard "add task" but not the task itself — try "add task finish lab report due tomorrow".'
        }
      } else if (completeMatch) {
        const name = (completeMatch[2] || '').trim().toLowerCase()
        const found = d.tasks.find((t) => t.status !== 'Done' && t.title.toLowerCase().includes(name))
        if (found) {
          d.tasks = d.tasks.map((t) => (t.id === found.id ? { ...t, status: 'Done', completedOn: todayISO() } : t))
          reply = `Marked "${found.title}" as done. Nice work.`
        } else {
          reply = `I couldn't find an open task matching "${completeMatch[2].trim()}".`
        }
      } else if (scheduleMatch) {
        const upcoming = d.events
          .slice()
          .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
          .filter((e) => e.date >= todayISO())
          .slice(0, 3)
        reply = upcoming.length
          ? `Coming up: ${upcoming.map((e) => `${e.title} on ${fmtDate(e.date)}`).join(', ')}.`
          : "You don't have anything scheduled yet."
      } else if (summaryMatch) {
        const open = d.tasks.filter((t) => t.status !== 'Done').length
        const done = d.tasks.filter((t) => t.status === 'Done').length
        reply = `You have ${open} open task${open === 1 ? '' : 's'} and ${done} completed.`
      } else if (connectMatch) {
        setState((s) => ({ ...s, device: { ...s.device, connected: true, lastSync: new Date().toISOString() } }))
        reply = 'Device reconnected and synced.'
      } else {
        reply = 'I didn\'t catch that. Try "add task ...", "complete task ...", or "show my schedule".'
      }

      d.voiceLog.push({ from: 'bot', text: reply, at: new Date().toISOString() })
      speak(reply)
      return d
    })
  }

  const value = {
    state,
    currentUser,
    userData,
    route,
    setRoute,
    modal,
    openModal: (type, payload = null) => setModal({ type, payload }),
    closeModal: () => setModal({ type: null, payload: null }),
    toast,
    showToast,
    register,
    login,
    logout,
    updateProfile,
    toggleDevice,
    addTask,
    updateTask,
    toggleTask,
    deleteTask,
    addEvent,
    deleteEvent,
    clearUserData,
    sendVoiceCommand
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { uid, todayISO, fmtDate, cap, parseLooseDate, speak } from '../utils.js'

const STORAGE_KEY = 'kasarita_state_v3'
const THEME_STORAGE_KEY = 'kasarita_theme'
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS_BASE = API_BASE.replace(/^http/, 'ws') + '/ws'

const AppContext = createContext(null)

const INITIAL_ACHIEVEMENTS = [
  { id: 'ach_1', name: 'First Study', description: 'Complete your first study session.', xpReward: 50, unlocked: true, icon: '🎓' },
  { id: 'ach_2', name: 'Task Crusher', description: 'Complete 5 tasks in total.', xpReward: 100, unlocked: false, icon: '⚡' },
  { id: 'ach_3', name: 'Deep Focus', description: 'Complete a 30-minute focus session.', xpReward: 75, unlocked: false, icon: '🧠' },
  { id: 'ach_4', name: 'Streak Master', description: 'Maintain a 5-day study streak.', xpReward: 150, unlocked: true, icon: '🔥' },
  { id: 'ach_5', name: 'Deadline Crusher', description: 'Complete 3 tasks before their due date.', xpReward: 100, unlocked: false, icon: '🎯' }
]

const INITIAL_QUESTS = [
  { id: 'q_1', title: 'Complete 2 pending tasks', xpReward: 25, completed: false },
  { id: 'q_2', title: 'Focus study for 25 minutes', xpReward: 35, completed: false },
  { id: 'q_3', title: 'Ask Kasarita AI a study question', xpReward: 20, completed: true }
]

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
    { id: uid(), title: 'Finish CS elective proposal', category: 'Coding', priority: 'High', status: 'In progress', due: todayISO(), notes: '' },
    { id: uid(), title: 'Read Chapter 4 Embedded Systems notes', category: 'Study', priority: 'Medium', status: 'To do', due: null, notes: '' },
    { id: uid(), title: 'Submit SQL Database lab report', category: 'Database', priority: 'Low', status: 'Done', due: todayISO(), notes: '' }
  ]
}

function sampleEvents() {
  const t = todayISO()
  return [
    { id: uid(), title: 'Software Engineering lecture', date: t, time: '09:00', type: 'Class' },
    { id: uid(), title: 'Study session — Data Structures', date: t, time: '19:00', type: 'Study' }
  ]
}

function sampleMessages() {
  return [
    { id: uid(), role: 'assistant', content: 'Welcome back! Your Database assignment is due tomorrow. Would you like to start a 25-minute study session?', source: 'esp32', timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: uid(), role: 'user', content: 'Show my tasks for today', source: 'web', timestamp: new Date(Date.now() - 1800000).toISOString() },
    { id: uid(), role: 'assistant', content: 'You have 3 tasks for today: Finish CS proposal, Read Chapter 4 notes, and Submit SQL lab report.', source: 'web', timestamp: new Date(Date.now() - 1790000).toISOString() }
  ]
}

function defaultUserData() {
  return {
    tasks: sampleTasks(),
    events: sampleEvents(),
    messages: sampleMessages(),
    gamification: {
      xp: 1240,
      streak: 6,
      lastStudyDate: todayISO(),
      achievements: INITIAL_ACHIEVEMENTS,
      quests: INITIAL_QUESTS,
      subjectTime: { Coding: 360, Database: 240, Networking: 180, Math: 120 }
    }
  }
}

function defaultState() {
  const demoUser = { id: 'u_demo', name: 'Student', email: 'student@email.com', password: 'pass' }
  return {
    users: [demoUser],
    currentUserId: demoUser.id,
    data: { [demoUser.id]: defaultUserData() },
    device: { connected: true, wakeWord: false, lastSync: new Date().toISOString() }
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw)
    if (!parsed.data) parsed.data = {}
    if (!parsed.currentUserId && parsed.users?.[0]) parsed.currentUserId = parsed.users[0].id
    return parsed
  } catch (e) {
    console.warn('Kasarita: starting with default state.', e)
    return defaultState()
  }
}

function loadTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch (e) {
    console.warn('Kasarita: using the default light theme.', e)
    return 'light'
  }
}

export function AppProvider({ children }) {
  const [state, setState] = useState(loadState)
  const [theme, setTheme] = useState(loadTheme)
  const [reminders, setReminders] = useState([])
  const [remindersLoadError, setRemindersLoadError] = useState(false)
  const [route, setRoute] = useState('dashboard')
  const [modal, setModal] = useState({ type: null, payload: null })
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)
  const wsRef = useRef(null)

  // Active Study Session Timer State
  const [studyTimer, setStudyTimer] = useState({
    isRunning: false,
    subject: 'Coding',
    durationMinutes: 25,
    secondsLeft: 1500
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.warn('Kasarita: could not save state.', e)
    }
  }, [state])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch (e) {
      console.warn('Kasarita: could not save theme preference.', e)
    }
  }, [theme])

  // Study Timer Interval Tick
  useEffect(() => {
    let interval = null
    if (studyTimer.isRunning && studyTimer.secondsLeft > 0) {
      interval = setInterval(() => {
        setStudyTimer((prev) => ({ ...prev, secondsLeft: prev.secondsLeft - 1 }))
      }, 1000)
    } else if (studyTimer.isRunning && studyTimer.secondsLeft === 0) {
      setStudyTimer((prev) => ({ ...prev, isRunning: false }))
      completeStudySession(studyTimer.subject, studyTimer.durationMinutes)
    }
    return () => clearInterval(interval)
  }, [studyTimer.isRunning, studyTimer.secondsLeft])

  function showToast(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3000)
  }

  const currentUser = state.users.find((u) => u.id === state.currentUserId) || state.users[0] || null
  const userData = currentUser
    ? state.data[currentUser.id] || defaultUserData()
    : defaultUserData()

  const currentUserRef = useRef(currentUser)
  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  // Calculate Level & Progress from XP
  const xp = userData.gamification?.xp || 1240
  const level = Math.floor(xp / 250) + 1
  const currentLevelXp = xp % 250
  const xpToNextLevel = 250

  function mutateUserData(userId, fn) {
    setState((s) => {
      const existing = s.data[userId] || defaultUserData()
      const next = fn({
        tasks: [...(existing.tasks || [])],
        events: [...(existing.events || [])],
        messages: [...(existing.messages || [])],
        gamification: { ...existing.gamification }
      })
      return { ...s, data: { ...s.data, [userId]: next } }
    })
  }

  function awardXp(amount, reason) {
    const user = currentUserRef.current
    if (!user) return
    mutateUserData(user.id, (d) => {
      const oldXp = d.gamification.xp || 0
      const newXp = oldXp + amount
      d.gamification.xp = newXp
      const oldLvl = Math.floor(oldXp / 250) + 1
      const newLvl = Math.floor(newXp / 250) + 1

      if (newLvl > oldLvl) {
        showToast(`🎉 LEVEL UP! You reached Level ${newLvl}! (+${amount} XP)`)
      } else {
        showToast(`+${amount} XP earned: ${reason}`)
      }
      return d
    })
  }

  function reloadTasks() {
    const user = currentUserRef.current
    if (!user) return
    fetch(`${API_BASE}/tasks`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(({ tasks }) => {
        if (Array.isArray(tasks)) {
          mutateUserData(user.id, (d) => ({
            ...d,
            tasks: tasks.map(fromApiTask)
          }))
        }
      })
      .catch(() => {})
  }

  function reloadReminders() {
    fetch(`${API_BASE}/reminders`)
      .then((res) => {
        if (!res.ok) throw new Error(`Reminder request failed with status ${res.status}`)
        return res.json()
      })
      .then(({ reminders: savedReminders }) => {
        if (!Array.isArray(savedReminders)) {
          throw new Error('Reminder response did not contain a reminders list')
        }
        setReminders(savedReminders)
        setRemindersLoadError(false)
      })
      .catch((error) => {
        console.warn('Kasarita: could not load reminders.', error)
        setRemindersLoadError(true)
      })
  }

  async function markReminderDone(reminderId) {
    try {
      const response = await fetch(`${API_BASE}/reminders/${reminderId}`, { method: 'PATCH' })
      const payload = await response.json()
      if (!response.ok || payload.status !== 'ok') {
        throw new Error(payload.error || `Reminder update failed with status ${response.status}`)
      }
      setReminders((items) => items.map((item) =>
        item.id === reminderId ? payload.reminder : item
      ))
      showToast('Reminder marked as done.')
    } catch (error) {
      console.warn('Kasarita: could not complete reminder.', error)
      showToast('Could not mark reminder as done. Please try again.')
    }
  }

  async function deleteReminder(reminderId) {
    try {
      const response = await fetch(`${API_BASE}/reminders/${reminderId}`, { method: 'DELETE' })
      const payload = await response.json()
      if (!response.ok || payload.status !== 'ok') {
        throw new Error(payload.error || `Reminder deletion failed with status ${response.status}`)
      }
      setReminders((items) => items.filter((item) => item.id !== reminderId))
      showToast('Reminder deleted.')
    } catch (error) {
      console.warn('Kasarita: could not delete reminder.', error)
      showToast('Could not delete reminder. Please try again.')
    }
  }

  useEffect(() => {
    reloadTasks()
    reloadReminders()
  }, [currentUser?.id])

  const lastMsgRef = useRef({ role: '', content: '', time: 0 })

  function addMessage(role, content, source = 'web') {
    const user = currentUserRef.current
    if (!user || !content) return null

    // Dedup guard: reject identical role+content within 2 seconds
    const now = Date.now()
    const last = lastMsgRef.current
    if (last.role === role && last.content === content && now - last.time < 2000) {
      return null
    }
    lastMsgRef.current = { role, content, time: now }

    const msg = {
      id: uid(),
      role,
      content,
      source,
      timestamp: new Date().toISOString()
    }
    mutateUserData(user.id, (d) => {
      d.messages = [...(d.messages || []), msg]
      return d
    })
    return msg
  }

  // Real-time WebSocket connection to backend
  useEffect(() => {
    let reconnectTimer = null
    let mounted = true

    function connect() {
      if (!mounted) return
      try {
        const ws = new WebSocket(WS_BASE)
        wsRef.current = ws

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data)
            const source = payload.source || 'esp32'

            // Record transcript as user msg + reply as assistant msg
            if (payload.transcript) {
              addMessage('user', payload.transcript, source)
            }
            if (payload.reply) {
              addMessage('assistant', payload.reply, source)
            }

            if (source === 'esp32') {
              showToast('🎙️ Voice activity received from ESP32!')
            }

            // If task command executed on ESP32 or backend, refresh task list
            if (payload.tool || payload.status === 'action_completed') {
              reloadTasks()
              reloadReminders()
            }
          } catch (err) {
            console.warn('WebSocket message parse error:', err)
          }
        }

        ws.onclose = () => {
          wsRef.current = null
          if (mounted) {
            reconnectTimer = setTimeout(connect, 3000)
          }
        }

        ws.onerror = () => {
          ws.close()
        }
      } catch (err) {
        console.warn('WebSocket connection not available.')
        if (mounted) {
          reconnectTimer = setTimeout(connect, 5000)
        }
      }
    }

    connect()

    return () => {
      mounted = false
      clearTimeout(reconnectTimer)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])


  function startStudySession(subject = 'Coding', minutes = 25) {
    setStudyTimer({
      isRunning: true,
      subject,
      durationMinutes: minutes,
      secondsLeft: minutes * 60
    })
    showToast(`Started ${minutes}-minute focus session for ${subject}!`)
  }

  function pauseStudySession() {
    setStudyTimer((prev) => ({ ...prev, isRunning: false }))
  }

  function resumeStudySession() {
    setStudyTimer((prev) => ({ ...prev, isRunning: true }))
  }

  function completeStudySession(subject, minutes) {
    if (!currentUser) return
    mutateUserData(currentUser.id, (d) => {
      const currentSubTime = d.gamification.subjectTime[subject] || 0
      d.gamification.subjectTime[subject] = currentSubTime + minutes

      // Check streak
      if (d.gamification.lastStudyDate !== todayISO()) {
        d.gamification.streak = (d.gamification.streak || 0) + 1
        d.gamification.lastStudyDate = todayISO()
      }
      return d
    })

    awardXp(25 + Math.floor(minutes / 2), `Completed ${minutes}m ${subject} study session`)
    addMessage('assistant', `Awesome job! You completed a ${minutes}-minute ${subject} study session and earned XP!`, 'web')
  }

  function addTask(task) {
    if (!currentUser) return
    const localId = uid()
    fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        arguments: {
          title: task.title,
          due_date: task.due || null,
          priority: (task.priority || 'Medium').toLowerCase(),
          status: task.status === 'Done' ? 'completed' : 'pending'
        }
      })
    })
      .then((res) => res.json())
      .then((payload) => {
        if (payload.status === 'ok') {
          mutateUserData(currentUser.id, (d) => ({
            ...d,
            tasks: [fromApiTask(payload.task), ...d.tasks.filter((item) => item.id !== localId)]
          }))
        }
      })
      .catch(() => {})

    mutateUserData(currentUser.id, (d) => {
      d.tasks = [{ id: localId, completedOn: task.status === 'Done' ? todayISO() : undefined, ...task }, ...d.tasks]
      return d
    })
    showToast(`Task created: "${task.title}"`)
  }

  function toggleTask(id) {
    if (!currentUser) return
    const task = userData.tasks.find((t) => t.id === id)
    if (!task) return
    const isNowDone = task.status !== 'Done'

    fetch(`${API_BASE}/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arguments: { status: isNowDone ? 'completed' : 'pending' } })
    }).catch(() => {})

    mutateUserData(currentUser.id, (d) => {
      d.tasks = d.tasks.map((t) => {
        if (t.id !== id) return t
        return {
          ...t,
          status: isNowDone ? 'Done' : 'To do',
          completedOn: isNowDone ? todayISO() : undefined
        }
      })
      return d
    })

    if (isNowDone) {
      awardXp(10, `Completed task "${task.title}"`)
    }
  }

  function deleteTask(id) {
    if (!currentUser) return
    fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' }).catch(() => {})
    mutateUserData(currentUser.id, (d) => {
      d.tasks = d.tasks.filter((t) => t.id !== id)
      return d
    })
    showToast('Task removed.')
  }

  function sendWebChatMessage(text) {
    if (!text.trim() || !currentUser) return
    addMessage('user', text, 'web')

    // Send via WebSocket for a real AI reply with session memory
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text, source: 'web', session_id: currentUser.id }))
    } else {
      // Fallback: use HTTP /chat endpoint if WS is down
      fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, session_id: currentUser.id })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.reply) {
            addMessage('assistant', data.reply, 'web')
          }
        })
        .catch(() => {
          addMessage('assistant', 'Sorry, I could not reach the server. Please check the backend is running.', 'web')
        })
    }
  }

  function clearChatMemory() {
    if (!currentUser) return
    fetch(`${API_BASE}/memory?session_id=${currentUser.id}`, { method: 'DELETE' }).catch(() => {})
    mutateUserData(currentUser.id, (d) => {
      d.messages = []
      return d
    })
    showToast('Conversation memory cleared.')
  }


  function completeQuest(questId) {
    if (!currentUser) return
    const quest = userData.gamification?.quests?.find((q) => q.id === questId)
    if (!quest || quest.completed) return

    mutateUserData(currentUser.id, (d) => {
      d.gamification.quests = d.gamification.quests.map((q) =>
        q.id === questId ? { ...q, completed: true } : q
      )
      return d
    })
    awardXp(quest.xpReward || 30, `Completed Quest: ${quest.title}`)
  }

  function register(name, email, password) {
    email = email.trim().toLowerCase()
    if (state.users.some((u) => u.email === email)) return { ok: false, error: 'Account already exists.' }
    const newUser = { id: uid(), name: name.trim() || email.split('@')[0], email, password }
    setState((s) => ({
      ...s,
      users: [...s.users, newUser],
      data: { ...s.data, [newUser.id]: defaultUserData() },
      currentUserId: newUser.id
    }))
    return { ok: true }
  }

  function login(email, password) {
    email = email.trim().toLowerCase()
    const found = state.users.find((u) => u.email === email && u.password === password)
    if (!found) return { ok: false, error: 'Invalid email or password.' }
    setState((s) => ({ ...s, currentUserId: found.id }))
    return { ok: true }
  }

  function logout() {
    setState((s) => ({ ...s, currentUserId: null }))
    setRoute('dashboard')
  }

  const value = {
    state,
    currentUser,
    userData,
    reminders,
    remindersLoadError,
    markReminderDone,
    deleteReminder,
    level,
    xp,
    theme,
    setTheme,
    currentLevelXp,
    xpToNextLevel,
    route,
    setRoute,
    modal,
    openModal: (type, payload = null) => setModal({ type, payload }),
    closeModal: () => setModal({ type: null, payload: null }),
    toast,
    showToast,
    studyTimer,
    startStudySession,
    pauseStudySession,
    resumeStudySession,
    completeStudySession,
    awardXp,
    addTask,
    toggleTask,
    deleteTask,
    sendWebChatMessage,
    clearChatMemory,
    completeQuest,
    register,
    login,
    logout
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

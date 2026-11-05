export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function fmtDate(iso) {
  if (!iso) return 'No date'
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d)) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function fmtDateTime(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function parseLooseDate(raw) {
  const s = raw.trim().toLowerCase()
  const d = new Date()
  if (s === 'today') return todayISO()
  if (s === 'tomorrow') {
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }
  const parsed = new Date(s)
  if (!isNaN(parsed)) return parsed.toISOString().slice(0, 10)
  return null
}

export function computeStats(tasks) {
  const total = tasks.length
  const completed = tasks.filter((t) => t.status === 'Done').length
  const byPriority = { High: 0, Medium: 0, Low: 0 }
  tasks.forEach((t) => {
    if (byPriority[t.priority] !== undefined) byPriority[t.priority]++
  })

  const days = []
  for (let i = 6; i >= 0; i--) {
    const dt = new Date()
    dt.setDate(dt.getDate() - i)
    days.push(dt.toISOString().slice(0, 10))
  }
  const weekly = days.map((day) => tasks.filter((t) => t.status === 'Done' && t.completedOn === day).length)

  let streak = 0
  for (let i = 0; i < days.length; i++) {
    const idx = days.length - 1 - i
    if (weekly[idx] > 0) streak++
    else break
  }

  return {
    total,
    completed,
    rate: total ? Math.round((completed / total) * 100) : 0,
    byPriority,
    days,
    weekly,
    streak
  }
}

export function speak(text) {
  try {
    if ('speechSynthesis' in window && text) {
      const cleanText = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/[*#~_`|\[\]{}]/g, '')
        .replace(/[-_]{2,}/g, ' ')
        .trim()

      if (!cleanText) return

      const u = new SpeechSynthesisUtterance(cleanText)
      u.rate = 1.0
      u.pitch = 1.05
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    }
  } catch (e) {
    // speech synthesis unavailable
  }
}


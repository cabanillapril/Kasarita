import React, { useState, useEffect } from 'react'
import { useApp } from '../context/store.jsx'
import { Sparkles, CheckCircle2, Circle, Flame, Timer, ArrowRight, Trophy, BookOpen, ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react'

const CS_FACTS = [
  { emoji: '🧮', fact: 'The first computer bug was an actual bug — a moth found trapped in a relay of the Harvard Mark II computer in 1947 by Grace Hopper.' },
  { emoji: '💾', fact: 'The first hard disk drive, the IBM 350, was introduced in 1956 and could store just 3.75 MB — about the size of one MP3 song today.' },
  { emoji: '🌐', fact: 'The internet was invented in 1969 as ARPANET, a US military project. The first message ever sent was "lo" — the system crashed before "login" could finish.' },
  { emoji: '🐍', fact: 'Python was named after the British comedy group Monty Python, not the snake. Its creator, Guido van Rossum, was reading Monty Python\'s scripts when he designed it.' },
  { emoji: '⚡', fact: 'A modern CPU can execute billions of instructions per second. If a human performed one operation per second, it would take 31 years to match what a CPU does in 1 second.' },
  { emoji: '🔢', fact: 'All data in a computer is ultimately stored as binary (0s and 1s). A single "bit" is the smallest unit of data — short for "binary digit".' },
  { emoji: '🎮', fact: 'The first video game ever created was "Tennis for Two" in 1958, displayed on an oscilloscope screen. Pong came 14 years later in 1972.' },
  { emoji: '🤖', fact: 'The term "Artificial Intelligence" was coined by John McCarthy in 1956 at the Dartmouth Conference — the same year the first AI program was written.' },
  { emoji: '📱', fact: 'There are more mobile phones on Earth than toothbrushes. As of 2024, over 6.9 billion people own a smartphone.' },
  { emoji: '🔐', fact: 'Modern encryption uses 256-bit keys. Breaking one would take longer than the current age of the universe, even with the fastest supercomputer.' },
  { emoji: '☁️', fact: 'The "cloud" is just someone else\'s computer — millions of physical servers in massive data centers around the world.' },
  { emoji: '🔗', fact: 'The World Wide Web and the Internet are NOT the same thing. The Internet is the network; the Web is just one service that runs on it.' },
  { emoji: '🌍', fact: 'Google processes over 8.5 billion searches per day — about 99,000 every single second.' },
  { emoji: '🧬', fact: 'DNA can store data too! Scientists have encoded entire movies, books, and operating systems into synthetic DNA strands.' },
  { emoji: '🖥️', fact: 'The Apollo 11 spacecraft that landed on the moon had less computing power than a modern USB flash drive.' },
  { emoji: '♾️', fact: 'There are only 10 types of people in the world: those who understand binary, and those who don\'t.' },
  { emoji: '📡', fact: 'Wi-Fi stands for nothing — it was created as a marketing brand name. The "Fi" doesn\'t stand for "fidelity"; the inventor made it rhyme with Hi-Fi.' },
  { emoji: '🧩', fact: 'The Linux kernel, which powers Android phones, servers, and supercomputers, started as a hobby project by a Finnish student named Linus Torvalds in 1991.' },
  { emoji: '🚀', fact: 'SpaceX rockets run on Linux. NASA, Tesla, and most of the world\'s top 500 supercomputers also use Linux-based operating systems.' },
  { emoji: '🪲', fact: 'On average, professional software has 15–50 bugs per 1,000 lines of code. Space Shuttle software had less than 1 bug per 420,000 lines — the most reliable code ever written.' },
  { emoji: '🌟', fact: 'The first programmer in history was Ada Lovelace — a mathematician who wrote the first algorithm intended to be processed by Charles Babbage\'s Analytical Engine in 1843.' },
  { emoji: '📟', fact: 'Bluetooth is named after Harald Bluetooth, a 10th-century Danish king who unified dissonant Danish tribes — just like the protocol unifies different communication protocols.' },
  { emoji: '🔋', fact: 'If a car improved as fast as computer chips have since 1971, it would now travel at 300,000 mph, cost $0.004, and get 2 million miles per gallon.' }
]

export default function Dashboard() {
  const {
    currentUser,
    level,
    xp,
    currentLevelXp,
    xpToNextLevel,
    userData,
    toggleTask,
    completeQuest,
    startStudySession,
    setRoute,
    openModal
  } = useApp()

  const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * CS_FACTS.length))
  const [factFading, setFactFading] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => rotateFact(1), 12000)
    return () => clearInterval(interval)
  }, [factIndex])

  function rotateFact(dir) {
    setFactFading(true)
    setTimeout(() => {
      setFactIndex((i) => (i + dir + CS_FACTS.length) % CS_FACTS.length)
      setFactFading(false)
    }, 250)
  }

  const tasks = userData?.tasks || []
  const todayTasks = tasks.filter((t) => t.status !== 'Done')
  const completedToday = tasks.filter((t) => t.status === 'Done')
  const completionRate = tasks.length > 0 ? Math.round((completedToday.length / tasks.length) * 100) : 0
  const quests = userData?.gamification?.quests || []
  const messages = userData?.messages || []
  const recentMessages = messages.slice(-3)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header Greeting */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div className="page-title-group">
          <h1>Welcome back, {currentUser?.name?.split(' ')[0] || 'Student'}! </h1>
          <p className="page-subtitle">Here is your study command center and learning progress for today.</p>
        </div>
        <button className="btn btn-primary" onClick={() => startStudySession('Coding', 25)}>
          <Timer size={18} />
          Start 25m Focus Session
        </button>
      </div>

      {/* Top XP Banner & Streak Card */}
      <div className="grid-3">
        {/* Level & XP Banner */}
        <div className="xp-banner" style={{ gridColumn: 'span 2' }}>
          <div className="xp-level-badge">
            <span className="lbl">LEVEL</span>
            <span className="num">{level}</span>
          </div>
          <div className="xp-details">
            <div className="xp-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)' }}>
                <Trophy size={16} color="var(--accent-amber)" /> Level {level} Scholar
              </span>
              <span style={{ color: 'var(--accent-pink)' }}>{currentLevelXp} / {xpToNextLevel} XP</span>
            </div>
            <div className="xp-progress-bar">
              <div
                className="xp-progress-fill"
                style={{ width: `${Math.min(100, (currentLevelXp / xpToNextLevel) * 100)}%` }}
              />
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Earn {xpToNextLevel - currentLevelXp} more XP to reach Level {level + 1}!
            </div>
          </div>
        </div>

        {/* Streak & Today's Progress Card */}
        <div className="glass-card streak-card" style={{ flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="flame-icon">🔥</span>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-amber)' }}>
                {userData?.gamification?.streak || 6} Days
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Study Streak Active</div>
            </div>
          </div>
          <div style={{ width: '100%', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
              <span>Today's Task Progress</span>
              <span style={{ fontWeight: '700', color: 'var(--accent-emerald)' }}>{completionRate}%</span>
            </div>
            <div className="xp-progress-bar" style={{ height: '8px' }}>
              <div className="xp-progress-fill" style={{ width: `${completionRate}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid-2">
        {/* Today's Tasks */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BookOpen size={20} color="var(--accent-indigo)" /> Today's Priority Tasks
            </h3>
            <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => openModal('task')}>
              + Add Task
            </button>
          </div>

          {todayTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={36} color="var(--accent-emerald)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
              All caught up! All tasks completed today.
            </div>
          ) : (
            todayTasks.slice(0, 4).map((task) => (
              <div key={task.id} className="task-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="task-checkbox" onClick={() => toggleTask(task.id)}>
                    <Circle size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{task.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {task.category} • {task.due ? `Due ${task.due}` : 'No deadline'}
                    </div>
                  </div>
                </div>
                <span className={`badge badge-${(task.priority || 'medium').toLowerCase()}`}>
                  {task.priority}
                </span>
              </div>
            ))
          )}

          {tasks.length > 4 && (
            <button
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: '0.75rem', justifyContent: 'center' }}
              onClick={() => setRoute('tasks')}
            >
              View all {tasks.length} tasks <ArrowRight size={16} />
            </button>
          )}
        </div>

        {/* Daily Quests */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={20} color="var(--accent-amber)" /> Today's Quests
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-amber)', fontWeight: '700' }}>
              Bonus XP Available
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {quests.map((quest) => (
              <div
                key={quest.id}
                className={`dashboard-quest${quest.completed ? ' completed' : ''}`}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: quest.completed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(15, 23, 42, 0.6)',
                  border: quest.completed ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: quest.completed ? 'default' : 'pointer'
                }}
                onClick={() => !quest.completed && completeQuest(quest.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className={`task-checkbox ${quest.completed ? 'checked' : ''}`}>
                    {quest.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  </div>
                  <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                    {quest.title}
                  </span>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--accent-pink)' }}>
                  +{quest.xpReward} XP
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CS Fun Fact Card (Did You Know?) */}
      <div className="funfact-card">
        <div className="funfact-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lightbulb size={17} color="var(--accent-amber)" />
            <span className="funfact-label">Did You Know?</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="funfact-counter">{factIndex + 1} / {CS_FACTS.length}</span>
            <button className="funfact-nav-btn" onClick={() => rotateFact(-1)} title="Previous fact">
              <ChevronLeft size={16} />
            </button>
            <button className="funfact-nav-btn" onClick={() => rotateFact(1)} title="Next fact">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className={`funfact-body ${factFading ? 'fading' : ''}`}>
          <span className="funfact-emoji">{CS_FACTS[factIndex].emoji}</span>
          <p className="funfact-text">{CS_FACTS[factIndex].fact}</p>
        </div>

        <div className="funfact-dots">
          {CS_FACTS.map((_, i) => (
            <button
              key={i}
              className={`funfact-dot ${i === factIndex ? 'active' : ''}`}
              onClick={() => { setFactFading(true); setTimeout(() => { setFactIndex(i); setFactFading(false) }, 250) }}
              aria-label={`Fact ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Recent AI Companion Activity Stream */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>Recent Voice & AI Activity</h3>
          <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setRoute('chat')}>
            Open Chat Companion <ArrowRight size={14} />
          </button>
        </div>

        {recentMessages.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No recent activity. Press the button on your ESP32 device or type in Chat!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentMessages.map((msg) => (
              <div
                key={msg.id}
                className="activity-entry"
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border-card)'
                }}
              >
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span className={`source-tag ${msg.source === 'esp32' ? 'tag-esp32' : 'tag-web'}`}>
                    {msg.source === 'esp32' ? 'ESP32 Voice' : 'Web App'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ fontSize: '0.9rem' }}>{msg.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

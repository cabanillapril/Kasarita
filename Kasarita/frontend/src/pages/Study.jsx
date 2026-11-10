import React, { useState } from 'react'
import { useApp } from '../context/store.jsx'
import {
  Timer, Play, Pause, RotateCcw, BookOpen, Code,
  Database, Wifi, FlaskConical, CheckCircle2, Zap,
  Coffee, Brain, Target, TrendingUp
} from 'lucide-react'

const SUBJECTS = [
  { name: 'Coding', icon: <Code size={18} />, color: 'var(--accent-violet)', gradient: 'var(--gradient-xp)' },
  { name: 'Study', icon: <BookOpen size={18} />, color: 'var(--accent-emerald)', gradient: 'var(--gradient-study)' },
  { name: 'Database', icon: <Database size={18} />, color: 'var(--accent-cyan)', gradient: 'linear-gradient(135deg, #06b6d4, #0ea5e9)' },
  { name: 'Networking', icon: <Wifi size={18} />, color: 'var(--accent-amber)', gradient: 'var(--gradient-streak)' },
  { name: 'Math', icon: <Brain size={18} />, color: 'var(--accent-pink)', gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)' },
  { name: 'Lab', icon: <FlaskConical size={18} />, color: '#a78bfa', gradient: 'linear-gradient(135deg, #a78bfa, #8b5cf6)' }
]

const DURATIONS = [
  { label: '10 min', minutes: 10, desc: 'Rest & Review' },
  { label: '15 min', minutes: 15, desc: 'Quick Burst' },
  { label: '25 min', minutes: 25, desc: 'Pomodoro' },
  { label: '90 min', minutes: 90, desc: 'Deep Work' }
]

const TECHNIQUES = [
  { name: 'Pomodoro', icon: <Timer size={16} />, desc: '25min focus + 5min break', duration: 25 },
  { name: 'Deep Work', icon: <Brain size={16} />, desc: '90 min immersive focus', duration: 90 },
  { name: 'Quick Burst', icon: <Zap size={16} />, desc: '15 min sprint session', duration: 15 },
  { name: 'Rest & Review', icon: <Coffee size={16} />, desc: 'Light 10 min review', duration: 10 }
]

function fmt(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function CircleTimer({ secondsLeft, totalSeconds, subject, durationMinutes }) {
  const subjectInfo = SUBJECTS.find((s) => s.name === subject) || SUBJECTS[0]
  const durationInfo = DURATIONS.find((duration) => duration.minutes === durationMinutes)
  const pct = totalSeconds > 0 ? secondsLeft / totalSeconds : 1
  const radius = 100
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct)

  return (
    <div className="timer-ring-container">
      <svg width="240" height="240" viewBox="0 0 240 240">
        {/* Track */}
        <circle cx="120" cy="120" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
        {/* Progress */}
        <circle
          cx="120" cy="120" r={radius}
          fill="none"
          stroke="url(#timerGrad)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 120 120)"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
        <defs>
          <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="timer-ring-center">
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
          {subjectInfo.icon} {subject}
        </div>
        <div className="timer-digits">{fmt(secondsLeft)}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          {pct === 0 ? '🎉 Done!' : 'remaining'}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          {durationMinutes} min{durationInfo ? ` · ${durationInfo.desc}` : ' session'}
        </div>
      </div>
    </div>
  )
}

export default function Study() {
  const { studyTimer, startStudySession, pauseStudySession, resumeStudySession, userData, setRoute } = useApp()

  const [selectedSubject, setSelectedSubject] = useState('Coding')
  const [selectedDuration, setSelectedDuration] = useState(25)

  const isIdle = !studyTimer.isRunning && studyTimer.secondsLeft === studyTimer.durationMinutes * 60
  const isFinished = !studyTimer.isRunning && studyTimer.secondsLeft === 0

  const subjectTime = userData?.gamification?.subjectTime || {}
  const totalMinutes = Object.values(subjectTime).reduce((a, b) => a + b, 0)

  function handleStart() {
    startStudySession(selectedSubject, selectedDuration)
  }

  function handleReset() {
    pauseStudySession()
    // Reset by re-initializing with current settings
    startStudySession(studyTimer.subject || selectedSubject, studyTimer.durationMinutes || selectedDuration)
    pauseStudySession()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div className="page-title-group">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Timer color="var(--accent-emerald)" /> Study Focus Timer
          </h1>
          <p className="page-subtitle">Use focused study sessions to earn XP and build your streak.</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid-4">
        <div className="glass-card stat-mini" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
          <TrendingUp size={20} color="var(--accent-emerald)" />
          <div>
            <div className="stat-val">{totalMinutes}m</div>
            <div className="stat-lbl">Total Studied</div>
          </div>
        </div>
        <div className="glass-card stat-mini" style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
          <span style={{ fontSize: '1.4rem' }}>🔥</span>
          <div>
            <div className="stat-val">{userData?.gamification?.streak || 0} days</div>
            <div className="stat-lbl">Study Streak</div>
          </div>
        </div>
        <div className="glass-card stat-mini" style={{ borderColor: 'rgba(139,92,246,0.3)' }}>
          <Target size={20} color="var(--accent-violet)" />
          <div>
            <div className="stat-val">{Math.floor(totalMinutes / 25)}</div>
            <div className="stat-lbl">Pomodoros Done</div>
          </div>
        </div>
        <div className="glass-card stat-mini" style={{ borderColor: 'rgba(6,182,212,0.3)' }}>
          <CheckCircle2 size={20} color="var(--accent-cyan)" />
          <div>
            <div className="stat-val">{userData?.tasks?.filter((t) => t.status === 'Done').length || 0}</div>
            <div className="stat-lbl">Tasks Completed</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Timer Panel */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '2.5rem 2rem' }}>
          <CircleTimer
            secondsLeft={isIdle ? selectedDuration * 60 : studyTimer.secondsLeft}
            totalSeconds={(isIdle ? selectedDuration : studyTimer.durationMinutes) * 60}
            subject={isIdle ? selectedSubject : studyTimer.subject || selectedSubject}
            durationMinutes={isIdle ? selectedDuration : studyTimer.durationMinutes}
          />

          {/* Controls */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {isFinished ? (
              <button
                id="timer-restart-btn"
                className="btn btn-emerald"
                onClick={handleStart}
                style={{ padding: '0.85rem 2rem', fontSize: '1rem' }}
              >
                <RotateCcw size={18} /> Start New Session
              </button>
            ) : studyTimer.isRunning ? (
              <>
                <button
                  id="timer-pause-btn"
                  className="btn btn-ghost"
                  onClick={pauseStudySession}
                  style={{ padding: '0.85rem 1.75rem', fontSize: '1rem' }}
                >
                  <Pause size={18} /> Pause
                </button>
                <button
                  id="timer-reset-btn"
                  className="btn btn-ghost"
                  onClick={handleReset}
                  style={{ padding: '0.85rem 1rem' }}
                  title="Reset timer"
                >
                  <RotateCcw size={18} />
                </button>
              </>
            ) : (
              <>
                <button
                  id="timer-start-btn"
                  className="btn btn-emerald"
                  onClick={studyTimer.secondsLeft > 0 && studyTimer.secondsLeft < studyTimer.durationMinutes * 60 ? resumeStudySession : handleStart}
                  style={{ padding: '0.85rem 2rem', fontSize: '1rem' }}
                >
                  <Play size={18} />
                  {studyTimer.secondsLeft > 0 && studyTimer.secondsLeft < studyTimer.durationMinutes * 60 ? 'Resume' : 'Start Session'}
                </button>
                {studyTimer.secondsLeft > 0 && studyTimer.secondsLeft < studyTimer.durationMinutes * 60 && (
                  <button id="timer-reset-btn2" className="btn btn-ghost" onClick={handleStart} style={{ padding: '0.85rem 1rem' }} title="New session">
                    <RotateCcw size={18} />
                  </button>
                )}
              </>
            )}
          </div>

          {isFinished && (
            <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(16,185,129,0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.3)', width: '100%' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🎉</div>
              <div style={{ fontWeight: '700', color: 'var(--accent-emerald)' }}>Session Complete!</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>XP has been awarded to your profile.</div>
            </div>
          )}
        </div>

        {/* Setup Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Subject Select */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Choose Subject</h3>
            <div className="subject-grid">
              {SUBJECTS.map((sub) => (
                <button
                  key={sub.name}
                  id={`subject-${sub.name.toLowerCase()}`}
                  className={`subject-btn ${selectedSubject === sub.name ? 'active' : ''}`}
                  style={selectedSubject === sub.name ? { background: sub.gradient, borderColor: 'transparent' } : {}}
                  onClick={() => setSelectedSubject(sub.name)}
                >
                  {sub.icon}
                  <span>{sub.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Duration Select */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Set Duration</h3>
            <div className="duration-grid">
              {DURATIONS.map((d) => (
                <button
                  key={d.minutes}
                  id={`duration-${d.minutes}`}
                  className={`duration-btn ${selectedDuration === d.minutes ? 'active' : ''}`}
                  onClick={() => setSelectedDuration(d.minutes)}
                >
                  <span className="duration-label">{d.label}</span>
                  <span className="duration-desc">{d.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Study Techniques */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Study Techniques</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {TECHNIQUES.map((t) => (
                <button
                  key={t.name}
                  className="technique-btn"
                  onClick={() => { setSelectedDuration(t.duration) }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-violet)' }}>
                    {t.icon} <strong>{t.name}</strong>
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Subject Time Breakdown */}
      <div className="glass-card">
        <h3 style={{ marginBottom: '1.25rem' }}>Time Per Subject</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {SUBJECTS.map((sub) => {
            const mins = subjectTime[sub.name] || 0
            const pct = totalMinutes > 0 ? (mins / totalMinutes) * 100 : 0
            return (
              <div key={sub.name} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '100px', display: 'flex', alignItems: 'center', gap: '0.4rem', color: sub.color, fontSize: '0.85rem', fontWeight: '600', flexShrink: 0 }}>
                  {sub.icon} {sub.name}
                </div>
                <div className="xp-progress-bar" style={{ flex: 1, height: '8px' }}>
                  <div className="xp-progress-fill" style={{ width: `${pct}%`, background: sub.gradient }} />
                </div>
                <div style={{ width: '50px', textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {mins}m
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

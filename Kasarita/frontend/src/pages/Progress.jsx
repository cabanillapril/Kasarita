import React from 'react'
import { useApp } from '../context/store.jsx'
import {
  Trophy, Zap, Flame, BookOpen, Code, Database,
  Wifi, Brain, Star, TrendingUp, Award, BarChart3
} from 'lucide-react'

const SUBJECT_META = {
  Coding: { icon: <Code size={16} />, color: '#8b5cf6', gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
  Study: { icon: <BookOpen size={16} />, color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #06b6d4)' },
  Database: { icon: <Database size={16} />, color: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4, #0ea5e9)' },
  Networking: { icon: <Wifi size={16} />, color: '#f59e0b', gradient: 'linear-gradient(135deg, #ef4444, #f59e0b)' },
  Math: { icon: <Brain size={16} />, color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)' },
  Lab: { icon: '🧪', color: '#a78bfa', gradient: 'linear-gradient(135deg, #a78bfa, #8b5cf6)' }
}

const LEVEL_TITLES = {
  1: 'Freshman Learner',
  2: 'Knowledge Seeker',
  3: 'Study Adept',
  4: 'Academic Explorer',
  5: 'Scholar Rising',
  6: 'Focus Master',
  7: 'Deep Thinker',
  8: 'Elite Scholar',
  9: 'Wisdom Seeker',
  10: 'Legend Student'
}

function AchievementCard({ ach }) {
  return (
    <div
      className={`achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}`}
      title={ach.description}
    >
      <div className="achievement-icon">
        {ach.unlocked ? ach.icon : '🔒'}
      </div>
      <div className="achievement-info">
        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: ach.unlocked ? 'var(--text-main)' : 'var(--text-dim)' }}>
          {ach.name}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
          {ach.description}
        </div>
        {ach.unlocked && (
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', fontWeight: '700', marginTop: '0.4rem' }}>
            +{ach.xpReward} XP Earned ✓
          </div>
        )}
      </div>
    </div>
  )
}

function XpMilestone({ label, xp, current, color }) {
  const pct = Math.min(100, (current / xp) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ width: '110px', fontSize: '0.82rem', color, fontWeight: '600', flexShrink: 0 }}>{label}</div>
      <div className="xp-progress-bar" style={{ flex: 1, height: '8px' }}>
        <div className="xp-progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div style={{ width: '70px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)', flexShrink: 0 }}>
        {current} / {xp}
      </div>
    </div>
  )
}

export default function Progress() {
  const { userData, level, xp, currentLevelXp, xpToNextLevel } = useApp()

  const gamification = userData?.gamification || {}
  const achievements = gamification.achievements || []
  const quests = gamification.quests || []
  const subjectTime = gamification.subjectTime || {}
  const streak = gamification.streak || 0

  const totalMinutes = Object.values(subjectTime).reduce((a, b) => a + b, 0)
  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const questsDone = quests.filter((q) => q.completed).length

  const levelTitle = LEVEL_TITLES[Math.min(level, 10)] || 'Legend'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div className="page-title-group">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Trophy color="var(--accent-amber)" /> Progress & Achievements
          </h1>
          <p className="page-subtitle">Track your academic journey, XP milestones, and unlocked achievements.</p>
        </div>
      </div>

      {/* Profile XP Card */}
      <div className="xp-banner-full">
        <div className="xp-avatar-ring">
          <div className="xp-level-badge" style={{ width: '90px', height: '90px' }}>
            <span className="lbl">LEVEL</span>
            <span className="num" style={{ fontSize: '2rem' }}>{level}</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.15rem' }}>
            {levelTitle}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            {xp} total XP earned · {xpToNextLevel - currentLevelXp} XP to Level {level + 1}
          </div>
          <div className="xp-progress-bar" style={{ height: '14px' }}>
            <div
              className="xp-progress-fill"
              style={{ width: `${(currentLevelXp / xpToNextLevel) * 100}%` }}
            />
          </div>
          <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.3rem', color: 'var(--accent-amber)' }}>{streak}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Day Streak 🔥</div>
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.3rem', color: 'var(--accent-emerald)' }}>{unlockedCount}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Achievements</div>
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.3rem', color: 'var(--accent-violet)' }}>{totalMinutes}m</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Time Studied</div>
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.3rem', color: 'var(--accent-cyan)' }}>{questsDone}/{quests.length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quests Done</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Achievements */}
        <div className="glass-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Award size={20} color="var(--accent-amber)" />
            Achievements
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '400' }}>
              {unlockedCount}/{achievements.length} unlocked
            </span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {achievements.map((ach) => (
              <AchievementCard key={ach.id} ach={ach} />
            ))}
          </div>
        </div>

        {/* Study Analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Subject Breakdown */}
          <div className="glass-card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <BarChart3 size={20} color="var(--accent-indigo)" />
              Study Time by Subject
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {Object.entries(subjectTime)
                .sort(([, a], [, b]) => b - a)
                .map(([subject, mins]) => {
                  const meta = SUBJECT_META[subject] || SUBJECT_META.Study
                  const pct = totalMinutes > 0 ? (mins / totalMinutes) * 100 : 0
                  return (
                    <div key={subject}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: meta.color, fontWeight: '600' }}>
                          {typeof meta.icon === 'string' ? meta.icon : meta.icon} {subject}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>{mins}m · {Math.round(pct)}%</span>
                      </div>
                      <div className="xp-progress-bar" style={{ height: '7px' }}>
                        <div className="xp-progress-fill" style={{ width: `${pct}%`, background: meta.gradient }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* XP Milestones */}
          <div className="glass-card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Zap size={20} color="var(--accent-violet)" />
              XP Milestones
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <XpMilestone label="🌱 Newcomer" xp={250} current={Math.min(xp, 250)} color="#10b981" />
              <XpMilestone label="📚 Scholar" xp={750} current={Math.min(xp, 750)} color="#6366f1" />
              <XpMilestone label="⚡ Expert" xp={1500} current={Math.min(xp, 1500)} color="#8b5cf6" />
              <XpMilestone label="🏆 Master" xp={3000} current={Math.min(xp, 3000)} color="#f59e0b" />
              <XpMilestone label="🌟 Legend" xp={5000} current={Math.min(xp, 5000)} color="#ec4899" />
            </div>
          </div>

          {/* Daily Quests */}
          <div className="glass-card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Star size={20} color="var(--accent-amber)" />
              Quest Log
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {quests.map((q) => (
                <div key={q.id} className={`quest-row ${q.completed ? 'done' : ''}`}>
                  <span style={{ fontSize: '1rem' }}>{q.completed ? '✅' : '⭕'}</span>
                  <span style={{ flex: 1, fontSize: '0.9rem', textDecoration: q.completed ? 'line-through' : 'none', color: q.completed ? 'var(--text-muted)' : 'var(--text-main)' }}>
                    {q.title}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--accent-pink)' }}>
                    +{q.xpReward} XP
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import { useApp } from '../context/store.jsx'
import {
  Trophy, Zap, Flame, Star, TrendingUp, Award, BarChart3
} from 'lucide-react'
import { getLevelTitle, XP_MILESTONES } from '../levelTitles.js'
import { DEFAULT_SUBJECT_NAMES, getSubjectColors } from '../subjectConfig.js'

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
    <div className="xp-milestone-row" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ width: '100px', fontSize: '0.82rem', color, fontWeight: '600', flexShrink: 0 }}>{label}</div>
      <div className="xp-progress-bar xp-milestone-bar" style={{ flex: 1, height: '8px' }}>
        <div className="xp-progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="xp-milestone-count" style={{ width: '96px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)', flexShrink: 0 }}>
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
  const configuredSubjects = Array.isArray(gamification.subjects) && gamification.subjects.length > 0
    ? gamification.subjects
    : DEFAULT_SUBJECT_NAMES
  const historicalSubjects = Object.keys(subjectTime)
    .filter((subject) => !configuredSubjects.includes(subject))
    .sort((a, b) => a.localeCompare(b))
  const subjectColors = getSubjectColors([...configuredSubjects, ...historicalSubjects])

  const totalMinutes = Object.values(subjectTime).reduce((a, b) => a + b, 0)
  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const questsDone = quests.filter((q) => q.completed).length

  const levelTitle = getLevelTitle(level)

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
              <div style={{ fontWeight: '800', fontSize: '1.3rem', color: 'var(--accent-white)' }}>{streak}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Day Streak</div>
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.3rem', color: 'var(--accent-white)' }}>{unlockedCount}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Achievements</div>
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.3rem', color: 'var(--accent-white)' }}>{totalMinutes}m</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Time Studied</div>
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.3rem', color: 'var(--accent-white)' }}>{questsDone}/{quests.length}</div>
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
                  const meta = subjectColors[subject] || { color: 'var(--accent-violet)', gradient: 'var(--gradient-xp)' }
                  const pct = totalMinutes > 0 ? (mins / totalMinutes) * 100 : 0
                  return (
                    <div key={subject}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: meta.color, fontWeight: '600' }}>
                          {subject}
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
              {XP_MILESTONES.map((milestone) => (
                <XpMilestone
                  key={milestone.label}
                  label={milestone.label}
                  xp={milestone.xp}
                  current={Math.min(xp, milestone.xp)}
                  color={milestone.color}
                />
              ))}
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
                  <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-main)' }}>
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

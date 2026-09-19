import React from 'react'
import { ArrowUpRight, BrainCircuit, CalendarDays, CheckCircle2, ListPlus, Mic2 } from 'lucide-react'
import { useApp } from '../context/store.jsx'
import { todayISO, computeStats } from '../utils.js'
import TaskRow from '../components/TaskRow.jsx'

export default function Dashboard() {
  const { userData, currentUser, setRoute, openModal } = useApp()
  const open = userData.tasks.filter((t) => t.status !== 'Done')
  const todays = (userData.events || [])
    .filter((e) => e.date === todayISO())
    .sort((a, b) => a.time.localeCompare(b.time))
  const stats = computeStats(userData.tasks)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            {greeting}, {currentUser.name.split(' ')[0]}.
          </h1>
          <div className="page-sub">
            {open.length} open task{open.length === 1 ? '' : 's'} · {stats.streak}-day completion streak
          </div>
        </div>
        <button className="btn btn-accent" onClick={() => openModal('task')}>
          + Add task
        </button>
      </div>

      <div className="dashboard-hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> STUDY COMMAND CENTER</span>
          <h2>Make today easier to finish.</h2>
          <p>Your tasks, schedule, and voice assistant are ready in one focused workspace.</p>
          <div className="hero-actions">
            <button className="btn btn-accent" onClick={() => openModal('task')}><ListPlus size={16} /> Add a task</button>
            <button className="btn btn-dark-ghost" onClick={() => setRoute('voice')}><Mic2 size={16} /> Ask Kasarita</button>
          </div>
        </div>
        <div className="hero-score">
          <div className="score-ring" style={{ '--progress': `${stats.rate}%` }}>
            <strong>{stats.rate}%</strong>
            <span>complete</span>
          </div>
          <div className="score-note"><CheckCircle2 size={15} /> {stats.completed} finished this cycle</div>
        </div>
      </div>

      <div className="stat-row">
        <StatCard icon={<ListPlus size={17} />} num={stats.total} label="Total tasks" />
        <StatCard icon={<CheckCircle2 size={17} />} num={stats.completed} label="Completed" />
        <StatCard icon={<BrainCircuit size={17} />} num={`${stats.streak}d`} label="Current streak" />
        <StatCard icon={<CalendarDays size={17} />} num={todays.length} label="Today's schedule" />
      </div>

      <div className="grid-dash">
        <div className="panel panel-tasks">
          <div className="panel-head">
            <div><span className="section-kicker">UP NEXT</span><h3>Priority tasks</h3></div>
            <button className="btn btn-ghost btn-sm" onClick={() => setRoute('tasks')}>
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          {open.length ? open.slice(0, 5).map((t) => <TaskRow key={t.id} task={t} />) : <div className="empty">No open tasks. Add one to get started.</div>}
        </div>
        <div className="panel panel-today">
          <div className="panel-head">
            <div><span className="section-kicker">YOUR RHYTHM</span><h3>Today</h3></div>
            <button className="btn btn-ghost btn-sm" onClick={() => setRoute('schedule')}>
              Full schedule <ArrowUpRight size={14} />
            </button>
          </div>
          {todays.length ? (
            <div className="timeline">
              {todays.map((e) => (
                <div className="tl-item" key={e.id}>
                  <div className="tl-time">{e.time}</div>
                  <div className="tl-title">{e.title}</div>
                  <div className="tl-type">{e.type}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">Nothing scheduled today.</div>
          )}
          <div className="quick-actions">
            <button onClick={() => setRoute('tasks')}><ListPlus size={15} /> Review tasks</button>
            <button onClick={() => setRoute('voice')}><Mic2 size={15} /> Use voice</button>
          </div>
        </div>
      </div>
    </>
  )
}

function StatCard({ icon, num, label }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-num">{num}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

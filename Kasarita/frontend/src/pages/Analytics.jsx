import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts'
import { useApp } from '../context/store.jsx'
import { computeStats } from '../utils.js'

const PRIORITY_COLORS = { High: '#FF5D5D', Medium: '#FFB020', Low: '#00B8A9' }

export default function Analytics() {
  const { userData } = useApp()
  const tasks = userData?.tasks || []
  const stats = useMemo(() => computeStats(tasks), [tasks])

  const weeklyData = stats.days.map((d, i) => ({
    day: new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' }),
    completed: stats.weekly[i]
  }))
  const priorityData = ['High', 'Medium', 'Low'].map((p) => ({ name: p, value: stats.byPriority[p] }))

  return (
    <div className="analytics-page">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div className="page-title-group">
          <h1>Task Analytics</h1>
          <p className="page-subtitle">
            Track task completion and priorities based on your saved tasks.
          </p>
        </div>
      </div>

      <div className="stat-row">
        <StatCard num={stats.total} label="Total tasks" detail="All saved tasks" tone="indigo" />
        <StatCard num={stats.completed} label="Completed" detail="Tasks marked done" tone="emerald" />
        <StatCard num={`${stats.rate}%`} label="Completion rate" detail="Completed out of total" tone="violet" />
        <StatCard num={stats.streak} label="Task completion streak" detail="Consecutive days with a completed task" tone="amber" />
      </div>

      <div className="grid-dash">
        <div className="glass-card analytics-chart-card">
          <div className="analytics-chart-heading">
            <div>
              <h2>Completed this week</h2>
              <p>Tasks finished in the last seven days</p>
            </div>
          </div>
          <div className="analytics-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '8px' }} />
                <Bar dataKey="completed" name="Completed tasks" fill="#00C2A8" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card analytics-chart-card">
          <div className="analytics-chart-heading">
            <div>
              <h2>Tasks by priority</h2>
              <p>Distribution of your open and completed tasks</p>
            </div>
          </div>
          {priorityData.some((entry) => entry.value > 0) ? (
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
                    {priorityData.map((entry) => (
                      <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="analytics-empty">
              Add tasks to see the priority breakdown.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ num, label, detail, tone }) {
  return (
    <div className={`stat-card stat-card-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-num">{num}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  )
}

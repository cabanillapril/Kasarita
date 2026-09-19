import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts'
import { useApp } from '../context/store.jsx'
import { computeStats } from '../utils.js'

const PRIORITY_COLORS = { High: '#FF5D5D', Medium: '#FFB020', Low: '#00B8A9' }

export default function Analytics() {
  const { userData } = useApp()
  const stats = useMemo(() => computeStats(userData.tasks), [userData.tasks])

  const weeklyData = stats.days.map((d, i) => ({
    day: new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' }),
    completed: stats.weekly[i]
  }))
  const priorityData = ['High', 'Medium', 'Low'].map((p) => ({ name: p, value: stats.byPriority[p] }))

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Analytics</h1>
          <div className="page-sub">
            A quick read on productivity — the same data an ISO/IEC 25010 usability &amp; performance evaluation would draw on.
          </div>
        </div>
      </div>

      <div className="stat-row">
        <StatCard num={stats.total} label="Total tasks" />
        <StatCard num={stats.completed} label="Completed" />
        <StatCard num={`${stats.rate}%`} label="Completion rate" />
        <StatCard num={stats.streak} label="Day streak" />
      </div>

      <div className="grid-dash">
        <div className="panel">
          <h3>Completed this week</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--ink-soft)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} stroke="var(--ink-soft)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'var(--paper)' }} />
                <Bar dataKey="completed" fill="#00C2A8" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <h3>Tasks by priority</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
                  {priorityData.map((entry) => (
                    <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  )
}

function StatCard({ num, label }) {
  return (
    <div className="stat-card">
      <div className="stat-num">{num}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

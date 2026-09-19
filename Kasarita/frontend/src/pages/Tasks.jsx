import React from 'react'
import { useApp } from '../context/store.jsx'
import TaskRow from '../components/TaskRow.jsx'

const ORDER = { High: 0, Medium: 1, Low: 2 }

export default function Tasks() {
  const { userData, openModal } = useApp()
  const tasks = [...userData.tasks].sort((a, b) => {
    const aDone = a.status === 'Done'
    const bDone = b.status === 'Done'
    if (aDone !== bDone) return aDone ? 1 : -1
    return ORDER[a.priority] - ORDER[b.priority]
  })

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Tasks</h1>
          <div className="page-sub">Create, prioritize, and track your academic tasks.</div>
        </div>
        <button className="btn btn-accent" onClick={() => openModal('task')}>
          + New task
        </button>
      </div>
      <div className="panel">
        {tasks.length ? tasks.map((t) => <TaskRow key={t.id} task={t} />) : <div className="empty">No tasks yet. Add your first one, or try the Voice tab.</div>}
      </div>
    </>
  )
}

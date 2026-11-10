import React from 'react'
import { Check, Pencil, Trash2 } from 'lucide-react'
import { fmtDate } from '../utils.js'
import { useApp } from '../context/store.jsx'

export default function TaskRow({ task }) {
  const { toggleTask, deleteTask, openModal } = useApp()
  const done = task.status === 'Done'
  return (
    <div className={`task-row p-${task.priority}${done ? ' done' : ''}`}>
      <button
        type="button"
        className={`task-checkbox task-check${done ? ' checked' : ''}`}
        onClick={() => toggleTask(task.id)}
        aria-label={done ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`}
      >
        {done && <Check size={13} strokeWidth={3} />}
      </button>
      <div className="task-main">
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          <span className="badge">{task.priority}</span>
          <span className="badge">{task.subject || task.category || 'General'}</span>
          <span>{task.due ? `Due ${fmtDate(task.due)}` : 'No due date'}</span>
        </div>
      </div>
      <div className="task-actions">
        <button className="icon-btn" onClick={() => openModal('task', task)} aria-label="Edit task">
          <Pencil size={15} />
        </button>
        <button className="icon-btn danger" onClick={() => deleteTask(task.id)} aria-label="Delete task">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

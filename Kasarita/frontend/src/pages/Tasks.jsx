import React, { useState, useMemo } from 'react'
import { useApp } from '../context/store.jsx'
import {
  Plus, Search, Filter, CheckCircle2, Circle, Trash2,
  Clock, AlertTriangle, ChevronDown, ListTodo, BookOpen,
  Code, Database, Wifi, FlaskConical, Pencil
} from 'lucide-react'

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2, Normal: 3 }
const STATUS_ORDER = { 'In progress': 0, 'To do': 1, Done: 2 }

const CATEGORY_ICONS = {
  Coding: <Code size={14} />,
  Study: <BookOpen size={14} />,
  Database: <Database size={14} />,
  Networking: <Wifi size={14} />,
  Lab: <FlaskConical size={14} />,
  General: <ListTodo size={14} />
}

const CATEGORIES = ['All', 'Coding', 'Study', 'Database', 'Networking', 'Lab', 'General']
const STATUSES = ['All', 'To do', 'In progress', 'Done']
const PRIORITIES = ['All', 'High', 'Medium', 'Low']

function TaskCard({ task, onToggle, onDelete, onEdit }) {
  const isDone = task.status === 'Done'
  const isOverdue = task.due && !isDone && new Date(task.due) < new Date()

  return (
    <div className="task-card">
      <div className="task-card-top">
        <button
          className={`task-checkbox ${isDone ? 'checked' : ''}`}
          onClick={() => onToggle(task.id)}
          title={isDone ? 'Mark incomplete' : 'Mark complete'}
        >
          {isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}
        </button>

        <div className="task-card-body">
          <div
            className="task-title"
            style={{ color: 'var(--text-main)' }}
          >
            {task.title}
          </div>
          {task.notes && (
            <div className="task-notes">{task.notes}</div>
          )}
        </div>

        <div className="task-card-actions">
          <button className="icon-btn" onClick={() => onEdit(task)} title="Edit">
            <Pencil size={14} />
          </button>
          <button className="icon-btn danger" onClick={() => onDelete(task.id)} title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="task-card-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className={`badge badge-${(task.priority || 'medium').toLowerCase()}`}>
            {task.priority || 'Normal'}
          </span>
          <span className="category-tag">
            {CATEGORY_ICONS[task.category] || CATEGORY_ICONS.General}
            {task.category || 'General'}
          </span>
          {task.status === 'In progress' && (
            <span className="status-tag in-progress">In Progress</span>
          )}
        </div>

        {task.due && (
          <div className={`due-date ${isOverdue ? 'overdue' : ''}`}>
            {isOverdue && <AlertTriangle size={12} />}
            <Clock size={12} />
            {isOverdue ? 'Overdue: ' : 'Due: '}
            {new Date(task.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Tasks() {
  const { userData, toggleTask, deleteTask, openModal } = useApp()
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterPriority, setFilterPriority] = useState('All')
  const [view, setView] = useState('list') // 'list' | 'board'

  const allTasks = userData?.tasks || []

  const filtered = useMemo(() => {
    return allTasks
      .filter((t) => {
        const matchSearch = t.title.toLowerCase().includes(search.toLowerCase())
        const matchCat = filterCategory === 'All' || t.category === filterCategory
        const matchStatus = filterStatus === 'All' || t.status === filterStatus
        const matchPri = filterPriority === 'All' || t.priority === filterPriority
        return matchSearch && matchCat && matchStatus && matchPri
      })
      .sort((a, b) => {
        const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        if (statusDiff !== 0) return statusDiff
        return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
      })
  }, [allTasks, search, filterCategory, filterStatus, filterPriority])

  const todo = filtered.filter((t) => t.status === 'To do')
  const inProgress = filtered.filter((t) => t.status === 'In progress')
  const done = filtered.filter((t) => t.status === 'Done')

  const completionRate = allTasks.length > 0
    ? Math.round((allTasks.filter((t) => t.status === 'Done').length / allTasks.length) * 100)
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div className="page-title-group">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ListTodo color="var(--accent-indigo)" /> My Tasks
          </h1>
          <p className="page-subtitle">
            {allTasks.length} tasks total · {allTasks.filter((t) => t.status === 'Done').length} completed ({completionRate}%)
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal('task')} id="new-task-btn">
          <Plus size={18} /> New Task
        </button>
      </div>

      {/* Progress Bar */}
      <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '600' }}>
          <span>Overall Completion</span>
          <span style={{ color: 'var(--accent-emerald)' }}>{completionRate}%</span>
        </div>
        <div className="xp-progress-bar" style={{ height: '10px' }}>
          <div
            className="xp-progress-fill"
            style={{ width: `${completionRate}%`, background: 'var(--gradient-study)' }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: '1rem 1.5rem' }}>
        <div className="tasks-filter-row">
          {/* Search */}
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
              id="task-search"
            />
          </div>

          {/* Category filter */}
          <div className="filter-select-wrap">
            <Filter size={14} />
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="filter-select" id="filter-category">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
            </select>
            <ChevronDown size={14} />
          </div>

          {/* Status filter */}
          <div className="filter-select-wrap">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select" id="filter-status">
              {STATUSES.map((s) => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
            </select>
            <ChevronDown size={14} />
          </div>

          {/* Priority filter */}
          <div className="filter-select-wrap">
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="filter-select" id="filter-priority">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p === 'All' ? 'All Priorities' : p}</option>)}
            </select>
            <ChevronDown size={14} />
          </div>

          {/* View toggle */}
          <div className="view-toggle">
            <button className={`view-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')} id="view-list-btn" title="List view">
              ≡
            </button>
            <button className={`view-btn ${view === 'board' ? 'active' : ''}`} onClick={() => setView('board')} id="view-board-btn" title="Board view">
              ⊞
            </button>
          </div>
        </div>
      </div>

      {/* Task Content */}
      {filtered.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <ListTodo size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem', display: 'block' }} />
          <h3 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>No tasks found</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            {search || filterCategory !== 'All' || filterStatus !== 'All' || filterPriority !== 'All'
              ? 'Try adjusting your filters.'
              : 'Create your first task or ask Kasarita via voice!'}
          </p>
          {!search && filterCategory === 'All' && (
            <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => openModal('task')}>
              <Plus size={16} /> Create First Task
            </button>
          )}
        </div>
      ) : view === 'list' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={toggleTask}
              onDelete={deleteTask}
              onEdit={(t) => openModal('task', t)}
            />
          ))}
        </div>
      ) : (
        /* Board View */
        <div className="board-view">
          <KanbanColumn title="To Do" color="var(--accent-indigo)" tasks={todo} onToggle={toggleTask} onDelete={deleteTask} onEdit={(t) => openModal('task', t)} count={todo.length} />
          <KanbanColumn title="In Progress" color="var(--accent-amber)" tasks={inProgress} onToggle={toggleTask} onDelete={deleteTask} onEdit={(t) => openModal('task', t)} count={inProgress.length} />
          <KanbanColumn title="Done" color="var(--accent-emerald)" tasks={done} onToggle={toggleTask} onDelete={deleteTask} onEdit={(t) => openModal('task', t)} count={done.length} />
        </div>
      )}
    </div>
  )
}

function KanbanColumn({ title, color, tasks, onToggle, onDelete, onEdit, count }) {
  return (
    <div className="kanban-col">
      <div className="kanban-col-header" style={{ borderColor: color }}>
        <span style={{ color, fontWeight: '700', fontSize: '0.95rem' }}>{title}</span>
        <span className="kanban-count" style={{ background: color }}>{count}</span>
      </div>
      <div className="kanban-tasks">
        {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem 1rem', fontSize: '0.85rem' }}>
            No tasks here
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} />
          ))
        )}
      </div>
    </div>
  )
}

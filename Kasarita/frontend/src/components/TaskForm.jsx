import React, { useState } from 'react'
import { useApp } from '../context/store.jsx'

export default function TaskForm({ existing, onDone }) {
  const { addTask, updateTask } = useApp()
  const isEdit = !!existing
  const [title, setTitle] = useState(existing?.title || '')
  const [category, setCategory] = useState(existing?.category || 'Academics')
  const [priority, setPriority] = useState(existing?.priority || 'Medium')
  const [status, setStatus] = useState(existing?.status || 'To do')
  const [due, setDue] = useState(existing?.due || '')
  const [notes, setNotes] = useState(existing?.notes || '')

  function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    const fields = { title: title.trim(), category: category.trim() || 'General', priority, status, due: due || null, notes: notes.trim() }
    if (isEdit) updateTask(existing.id, fields)
    else addTask(fields)
    onDone()
  }

  return (
    <form className="authform" onSubmit={submit}>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Finish thesis chapter 2" />
      </label>
      <div className="field-row">
        <div className="field">
          <label>Category</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Academics" />
        </div>
        <div className="field">
          <label>Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Due date</label>
          <input type="date" value={due || ''} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>To do</option>
            <option>In progress</option>
            <option>Done</option>
          </select>
        </div>
      </div>
      <label>
        Notes
        <textarea rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </label>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn-accent">
          {isEdit ? 'Save changes' : 'Add task'}
        </button>
      </div>
    </form>
  )
}

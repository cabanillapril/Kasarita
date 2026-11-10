import React, { useState } from 'react'
import { useApp } from '../context/store.jsx'
import { DEFAULT_SUBJECT_NAMES } from '../subjectConfig.js'
import { cap } from '../utils.js'

export default function TaskForm({ existing, onDone }) {
  const { addTask, updateTask, userData } = useApp()
  const isEdit = !!existing
  const [title, setTitle] = useState(existing?.title || '')
  const configuredSubjects = Array.isArray(userData?.gamification?.subjects) && userData.gamification.subjects.length > 0
    ? userData.gamification.subjects
    : DEFAULT_SUBJECT_NAMES
  const existingSubject = existing?.subject || existing?.category
  const subjects = existingSubject && !configuredSubjects.includes(existingSubject)
    ? [...configuredSubjects, existingSubject]
    : configuredSubjects
  const [subject, setSubject] = useState(existingSubject || subjects[0])
  const [priority, setPriority] = useState(existing?.priority || 'Medium')
  const [status, setStatus] = useState(existing?.status || 'To do')
  const [due, setDue] = useState(existing?.due || '')
  const [notes, setNotes] = useState(existing?.notes || '')

  function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    const fields = { title: cap(title.trim()), subject, priority, status, due: due || null, notes: notes.trim() }
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
          <label>Subject</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} required>
            {subjects.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
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

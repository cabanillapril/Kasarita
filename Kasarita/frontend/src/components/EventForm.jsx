import React, { useState } from 'react'
import { useApp } from '../context/store.jsx'
import { todayISO } from '../utils.js'

export default function EventForm({ onDone }) {
  const { addEvent } = useApp()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayISO())
  const [time, setTime] = useState('09:00')
  const [type, setType] = useState('Class')

  function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    addEvent({ title: title.trim(), date, time, type })
    onDone()
  }

  return (
    <form className="authform" onSubmit={submit}>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Databases lecture" />
      </label>
      <div className="field-row">
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="field">
          <label>Time</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </div>
      </div>
      <div className="field">
        <label>Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option>Class</option>
          <option>Study</option>
          <option>Exam</option>
          <option>Reminder</option>
        </select>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn-accent">
          Add entry
        </button>
      </div>
    </form>
  )
}

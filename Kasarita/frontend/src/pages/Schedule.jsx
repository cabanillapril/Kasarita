import React from 'react'
import { X } from 'lucide-react'
import { useApp } from '../context/store.jsx'
import { todayISO, fmtDate } from '../utils.js'

export default function Schedule() {
  const { userData, openModal, deleteEvent } = useApp()
  const events = [...(userData.events || [])].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))

  const groups = {}
  const order = []
  events.forEach((e) => {
    if (!groups[e.date]) {
      groups[e.date] = []
      order.push(e.date)
    }
    groups[e.date].push(e)
  })

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Schedule &amp; reminders</h1>
          <div className="page-sub">Classes, study sessions, and reminders in one timeline.</div>
        </div>
        <button className="btn btn-accent" onClick={() => openModal('event')}>
          + New entry
        </button>
      </div>
      <div className="panel">
        {order.length ? (
          order.map((date) => (
            <div className="tl-day" key={date}>
              <div className="tl-day-label">
                {date === todayISO() ? 'Today · ' : ''}
                {fmtDate(date)}
              </div>
              <div className="timeline">
                {groups[date].map((e) => (
                  <div className="tl-item" key={e.id}>
                    <div className="tl-time">{e.time}</div>
                    <div className="tl-title">
                      {e.title}{' '}
                      <button className="icon-btn danger inline" onClick={() => deleteEvent(e.id)} aria-label="Remove">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="tl-type">{e.type}</div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="empty">Nothing scheduled. Add a class, study session, or reminder.</div>
        )}
      </div>
    </>
  )
}

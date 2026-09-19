import React from 'react'

export default function Modal({ title, onClose, children }) {
  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal">
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}

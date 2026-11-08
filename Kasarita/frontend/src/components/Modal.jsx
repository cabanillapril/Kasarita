import React from 'react'

export default function Modal({ title, onClose, children }) {
  return (
    <div
      className="overlay"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h3 id="modal-title">{title}</h3>
        {children}
      </div>
    </div>
  )
}

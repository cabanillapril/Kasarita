import React, { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/store.jsx'
import { Send, Bot, User, Mic, Sparkles, Volume2, Trash2 } from 'lucide-react'
import { speak } from '../utils.js'

export default function Chat() {
  const { userData, sendWebChatMessage, clearChatMemory } = useApp()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)

  const messages = userData?.messages || []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend(e) {
    e.preventDefault()
    if (!input.trim()) return
    sendWebChatMessage(input)
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: 'calc(100vh - 100px)' }}>
      <div className="page-header" style={{ marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="page-title-group">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Bot color="var(--accent-violet)" /> Kasarita AI Companion
          </h1>
          <p className="page-subtitle">
            Converse with Kasarita
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChatMemory}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            title="Reset conversation context & clear history"
          >
            <Trash2 size={15} /> Clear Memory
          </button>
        )}
      </div>

      <div className="chat-container">
        {/* Messages Stream */}
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)' }}>
              <Bot size={48} color="var(--accent-violet)" style={{ marginBottom: '1rem' }} />
              <h3>Start a conversation with Kasarita</h3>
              <p style={{ fontSize: '0.9rem', marginTop: '0.4rem' }}>
                Press the physical button on your ESP32 to speak, or type a question or task below!
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`source-tag ${msg.source === 'esp32' ? 'tag-esp32' : 'tag-web'}`}>
                      {msg.source === 'esp32' ? '🎙️ ESP32 Voice' : '💻 Web App'}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => speak(msg.content)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--accent-violet)',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        fontSize: '0.75rem'
                      }}
                      title="Listen with Text-To-Speech"
                    >
                      <Volume2 size={14} /> Listen
                    </button>
                  )}
                </div>
                <div>{msg.content}</div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <form className="chat-input-bar" onSubmit={handleSend}>
          <input
            type="text"
            className="chat-input"
            placeholder="Talk with Kasarita (e.g. 'What is a binary tree?', 'Add task study SQL')..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            <Send size={16} /> Send
          </button>
        </form>
      </div>
    </div>
  )
}


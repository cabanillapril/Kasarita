import React, { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import { useApp } from '../context/store.jsx'

export default function Voice() {
  const { userData, sendVoiceCommand, showToast } = useApp()
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)
  const logRef = useRef(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [userData.voiceLog.length])

  function setupRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return null
    const r = new SR()
    r.lang = 'en-US'
    r.interimResults = false
    r.maxAlternatives = 1
    r.onresult = (ev) => {
      const spoken = ev.results[0][0].transcript
      setText(spoken)
      sendVoiceCommand(spoken)
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    return r
  }

  function toggleMic() {
    if (!recognitionRef.current) recognitionRef.current = setupRecognition()
    if (!recognitionRef.current) {
      showToast("Voice input needs a browser with speech recognition (e.g. Chrome).")
      return
    }
    if (listening) {
      recognitionRef.current.stop()
      setListening(false)
    } else {
      try {
        recognitionRef.current.start()
        setListening(true)
      } catch (e) {
        // recognition already running
      }
    }
  }

  function send() {
    if (text.trim()) {
      sendVoiceCommand(text)
      setText('')
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Voice commands</h1>
          <div className="page-sub">
            Type or speak — this mirrors the on-device ASR → NLU → dialogue → TTS pipeline for testing without hardware.
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="voicebar">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Try: add task finish reading due tomorrow"
          />
          <button className={`mic-btn${listening ? ' active' : ''}`} onClick={toggleMic} aria-label="Speak">
            <Mic size={18} />
          </button>
          <button className="btn btn-primary" onClick={send}>
            Send
          </button>
        </div>
        <div className="voicelog" ref={logRef}>
          {userData.voiceLog.length ? (
            userData.voiceLog.slice(-20).map((l, i) => (
              <div className={l.from === 'you' ? 'vlog-you' : 'vlog-bot'} key={i}>
                {l.text}
              </div>
            ))
          ) : (
            <div className="empty">No commands yet. Try "show my schedule" or "how many tasks".</div>
          )}
        </div>
        <div className="voice-hint">
          Supported: "add task … due …", "complete task …", "show my schedule", "how many tasks", "reconnect device". The mic
          button uses your browser's speech recognition where available.
        </div>
      </div>
    </>
  )
}

import React, { useState } from 'react'
import { useApp } from '../context/store.jsx'

export default function Auth() {
  const { register, login } = useApp()
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const isLogin = mode === 'login'

  function submit(e) {
    e.preventDefault()
    const result = isLogin ? login(email, password) : register(name, email, password)
    if (!result.ok) setError(result.error)
    else setError('')
  }

  return (
    <div className="boot-wrap">
      <div className="boot-card">
        <div className="boot-screen">
          KASARITA v1.0
          <br />
          ESP32-S3 :: MCP link idle
          <br />
          {isLogin ? 'awaiting sign-in' : 'creating profile'}
          <span className="cursor" />
        </div>
        <h1 className="boot-title">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="boot-sub">
          {isLogin ? 'Sign in to sync tasks with your Kasarita device.' : 'Set up your profile before pairing your device.'}
        </p>
        <form className="authform" onSubmit={submit}>
          {!isLogin && (
            <label>
              Full name
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Juan Dela Cruz" />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@school.edu.ph" />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="At least 6 characters"
            />
          </label>
          <div className="form-error">{error}</div>
          <button type="submit" className="btn btn-accent">
            {isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <div className="switch-line">
          {isLogin ? 'New to Kasarita? ' : 'Already have an account? '}
          <button
            onClick={() => {
              setMode(isLogin ? 'register' : 'login')
              setError('')
            }}
          >
            {isLogin ? 'Create an account' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}

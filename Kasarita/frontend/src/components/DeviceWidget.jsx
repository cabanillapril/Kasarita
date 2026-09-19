import React from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import { useApp } from '../context/store.jsx'
import { fmtDateTime } from '../utils.js'

export default function DeviceWidget() {
  const { state, toggleDevice } = useApp()
  const dev = state.device

  return (
    <div className="device-widget">
      <div className="dw-row">
        <span className="dw-label">Kasarita device</span>
        {dev.connected ? <Wifi size={14} /> : <WifiOff size={14} />}
      </div>
      <div className="dw-status">
        <span className={`dot ${dev.connected ? 'on' : 'off'}`} />
        {dev.connected ? 'Connected' : 'Offline'}
      </div>
      <div className="dw-status">
        <span className={`dot ${dev.wakeWord ? 'listening' : 'off'}`} />
        {dev.wakeWord ? 'Listening…' : 'Say "Hey Kasarita"'}
      </div>
      <div className="dw-sync">Last sync {fmtDateTime(dev.lastSync)}</div>
      <button className="dw-toggle" onClick={toggleDevice}>
        {dev.connected ? 'Disconnect' : 'Reconnect'}
      </button>
    </div>
  )
}

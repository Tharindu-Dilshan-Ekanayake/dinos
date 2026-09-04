import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { useGameStore } from './store/useGameStore.js'
import { flushSave, saveState } from './systems/persistence.js'
import { setMuted } from './systems/audio.js'
import { installSfx } from './systems/sfx.js'
import { orbit } from './systems/cameraOrbit.js'
import * as THREE from 'three'
import { playerMotion, playerPosition } from './systems/playerState.js'
import { packState } from './systems/arenaEnemies.js'
import * as input from './systems/input.js'

// The store is the single source of truth; persistence just mirrors it.
// Subscribing here (rather than inside every action) means no action can ever
// forget to save.
useGameStore.subscribe((state) => saveState(state))

// Game events drive the synthesised SFX.
installSfx()

// Keep the audio engine's mute flag in step with the store.
setMuted(useGameStore.getState().muted)
let lastMuted = useGameStore.getState().muted
useGameStore.subscribe((state) => {
  if (state.muted !== lastMuted) {
    lastMuted = state.muted
    setMuted(state.muted)
  }
})

// A debounced write can still be in flight when the tab goes away.
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSave()
})
window.addEventListener('pagehide', flushSave)

// Dev-only handles so the console (and the smoke tests) can inspect live game
// state. These must be the app's own module instances: importing the modules
// separately can hand back a second copy once HMR has versioned their URLs.
if (import.meta.env.DEV) {
  window.__dinoStore = useGameStore
  window.__dinoDebug = { playerPosition, playerMotion, packState, input, orbit, THREE }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

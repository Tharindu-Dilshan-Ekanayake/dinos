import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { useGameStore } from './store/useGameStore.js'
import { flushSave, saveState } from './systems/persistence.js'
import { setMuted, setVolume } from './systems/audio.js'
import { installSfx } from './systems/sfx.js'
import { orbit, setSensitivity } from './systems/cameraOrbit.js'
import * as THREE from 'three'
import { playerMotion, playerPosition } from './systems/playerState.js'
import { packState } from './systems/arenaEnemies.js'
import * as input from './systems/input.js'
import { EVENTS, on } from './systems/events.js'
import { subscribeMatchmaking } from './systems/matchmaking.js'
import {
  initBloxity,
  getBloxityAuthState,
  getBloxitySettings,
  isBloxityAvailable,
  subscribeBloxityPlayerEvent,
  subscribeBloxitySettings,
  bloxityGameplayStart,
  bloxityGameplayEnd,
  bloxityLoadingStep,
  bloxityUpdateRoom,
} from './systems/bloxity.js'

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

/*
 * Bloxity (the Legion SDK) - see systems/bloxity.js for the full wrapper and
 * why every call in it is safe to make whether or not the SDK ever loads.
 *
 * `initBloxity()` is fire-and-forget: it polls for `window.Legion` in the
 * background and every export degrades to a no-op until it's ready, so
 * nothing below has to wait on it.
 */
initBloxity()
// This game has no multi-phase loading to report - a single step is honest.
bloxityLoadingStep('Loading the dino…')

// Portal settings -> store, additively. The in-game Settings menu keeps
// working exactly as it does today; this just gives a hosting portal a
// second way to reach the same fields.
const QUALITY_FROM_PORTAL = { Low: 'low', Medium: 'medium', High: 'high', Ultra: 'high' }
subscribeBloxitySettings((settings) => {
  const s = useGameStore.getState()
  if (settings.master_volume !== undefined) s.setMasterVolume(settings.master_volume)
  if (QUALITY_FROM_PORTAL[settings.graphics_quality]) s.setQuality(QUALITY_FROM_PORTAL[settings.graphics_quality])
  if (settings.show_fps !== undefined) s.setShowFps(settings.show_fps === 'true')
  if (settings.camera_sensitivity !== undefined) s.setCameraSensitivity(settings.camera_sensitivity)
  if (settings.enable_chat !== undefined) s.setChatEnabled(settings.enable_chat !== 'false')
  if (settings.fullscreen !== undefined) s.setFullscreen(settings.fullscreen === 'true')
  // music_volume, background_transparency: intentionally not consumed - this
  // game has no music track and no page-chrome to make transparent. Still
  // registered (see systems/bloxity.js) so both surface in the portal menu.
})

// Store -> audio/camera consumers, the same mirror-and-diff shape the mute
// sync above already uses.
setVolume(useGameStore.getState().masterVolume)
setSensitivity(useGameStore.getState().cameraSensitivity)
let lastVolume = useGameStore.getState().masterVolume
let lastSensitivity = useGameStore.getState().cameraSensitivity
useGameStore.subscribe((state) => {
  if (state.masterVolume !== lastVolume) {
    lastVolume = state.masterVolume
    setVolume(state.masterVolume)
  }
  if (state.cameraSensitivity !== lastSensitivity) {
    lastSensitivity = state.cameraSensitivity
    setSensitivity(state.cameraSensitivity)
  }
})

// Scene <-> game lifecycle. enterArena() and the return-to-lobby actions
// already emit this for other listeners (see store/useGameStore.js).
on(EVENTS.SCENE_CHANGE, ({ scene }) => {
  if (scene === 'arena') {
    bloxityGameplayStart()
  } else {
    bloxityGameplayEnd()
    bloxityUpdateRoom('')
  }
})

// The matchmaking lobby (once joined) is the closest thing this game has to
// a "room" - let a hosting portal know so friend invites land in the right
// place.
let lastRoomId = ''
subscribeMatchmaking((mm) => {
  const roomId = mm.lobbyId ?? ''
  if (roomId !== lastRoomId) {
    lastRoomId = roomId
    bloxityUpdateRoom(roomId)
  }
})

// Player events from the host portal.
subscribeBloxityPlayerEvent((event, data) => {
  if (event === 'respawn_request') {
    useGameStore.getState().respawn()
  } else if (event === 'chat_message_sent') {
    // No chat system exists in this game (see systems/events.js's EVENTS
    // map) - logged only, and only when the synced setting allows it.
    if (useGameStore.getState().chatEnabled) {
      console.info('[bloxity] chat_message_sent (no chat UI to show it in):', data)
    }
  }
  // 'pointer_lock_changed': no-op. This game's orbit camera
  // (systems/cameraOrbit.js) drags on pointermove and never calls
  // requestPointerLock - kept here only for spec completeness.
})

// Dev-only handles so the console (and the smoke tests) can inspect live game
// state. These must be the app's own module instances: importing the modules
// separately can hand back a second copy once HMR has versioned their URLs.
if (import.meta.env.DEV) {
  window.__dinoStore = useGameStore
  window.__dinoDebug = { playerPosition, playerMotion, packState, input, orbit, THREE }
  window.__dinoDebug.bloxity = { getBloxityAuthState, getBloxitySettings, isBloxityAvailable }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

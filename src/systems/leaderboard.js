/**
 * Read-only shared leaderboard over a WebSocket.
 *
 * The transport is optional: with no VITE_LEADERBOARD_URL configured the game
 * runs fully offline and this module reports status "offline" rather than
 * retrying a connection that was never going to exist. Point it at a running
 * `npm run server` (or a hosted copy of it) to switch the panel on.
 *
 *   VITE_LEADERBOARD_URL=ws://localhost:8787  npm run dev
 *
 * v1 is deliberately one-way for gameplay: the client publishes its own totals
 * and renders whatever board comes back. There is no combat sync, and the
 * server is never trusted to change local game state.
 */
const URL = import.meta.env?.VITE_LEADERBOARD_URL ?? ''
const ROOM = import.meta.env?.VITE_LEADERBOARD_ROOM ?? 'global'

const PUBLISH_INTERVAL_MS = 5000
const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 20000

let socket = null
let publishTimer = null
let reconnectTimer = null
let attempts = 0
let closed = false

let state = {
  status: URL ? 'connecting' : 'offline',
  entries: [],
  room: ROOM,
  error: null,
}

const subscribers = new Set()

function update(patch) {
  state = { ...state, ...patch }
  subscribers.forEach((fn) => fn(state))
}

export function subscribeLeaderboard(fn) {
  subscribers.add(fn)
  fn(state)
  return () => subscribers.delete(fn)
}

export function getLeaderboardState() {
  return state
}

export const leaderboardEnabled = Boolean(URL)

/**
 * Start the connection. `getScore` is polled to publish this player's totals -
 * passing a getter rather than a value keeps the store as the source of truth.
 */
export function connectLeaderboard(getScore) {
  if (!URL || socket || closed) return

  update({ status: 'connecting', error: null })

  try {
    socket = new WebSocket(URL)
  } catch (error) {
    update({ status: 'error', error: String(error?.message ?? error) })
    scheduleReconnect(getScore)
    return
  }

  socket.addEventListener('open', () => {
    attempts = 0
    update({ status: 'online', error: null })
    send({ type: 'join', room: ROOM })
    publish(getScore)
    publishTimer = setInterval(() => publish(getScore), PUBLISH_INTERVAL_MS)
  })

  socket.addEventListener('message', (event) => {
    let payload
    try {
      payload = JSON.parse(event.data)
    } catch {
      return
    }
    if (payload?.type === 'board' && Array.isArray(payload.entries)) {
      // Everything here came from other clients: treat it as untrusted display
      // data only, never as anything that can touch local progress.
      update({
        entries: payload.entries.slice(0, 25).map((entry) => ({
          id: String(entry.id ?? ''),
          name: String(entry.name ?? 'Anonymous Dino').slice(0, 16),
          wins: Number(entry.wins) || 0,
          rebirths: Number(entry.rebirths) || 0,
          bestStage: Number(entry.bestStage) || 0,
        })),
      })
    }
  })

  socket.addEventListener('close', () => {
    cleanupSocket()
    if (!closed) {
      update({ status: 'reconnecting' })
      scheduleReconnect(getScore)
    }
  })

  socket.addEventListener('error', () => {
    update({ status: 'error', error: 'connection failed' })
  })
}

function send(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
}

function publish(getScore) {
  const score = getScore?.()
  if (!score) return
  send({
    type: 'score',
    room: ROOM,
    name: score.name?.trim() || 'Anonymous Dino',
    wins: score.wins,
    rebirths: score.rebirths,
    bestStage: score.bestStage,
  })
}

function cleanupSocket() {
  if (publishTimer) {
    clearInterval(publishTimer)
    publishTimer = null
  }
  socket = null
}

function scheduleReconnect(getScore) {
  if (reconnectTimer) return
  attempts += 1
  const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * Math.pow(2, attempts - 1))
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectLeaderboard(getScore)
  }, delay)
}

export function disconnectLeaderboard() {
  closed = true
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  socket?.close()
  cleanupSocket()
  update({ status: URL ? 'offline' : 'offline' })
}

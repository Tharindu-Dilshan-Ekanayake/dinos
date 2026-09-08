/**
 * Matchmaking client for the Socket.IO backend in /server.
 *
 * Mirrors the connection-as-a-module shape of `leaderboard.js`: one shared
 * socket, a plain state object, and a subscriber list, so any component can
 * read the current lobby without owning the connection itself.
 *
 *   VITE_MATCHMAKING_URL=http://localhost:3000  npm run dev
 *
 * This isn't an opt-in queue screen - the game shards players into lobbies of
 * up to 8 the moment it loads, the same way an idle game shards you into a
 * numbered server. `autoJoin` fires once on boot with whatever name is
 * already on hand (Settings, or a generated guest tag) so nobody has to stop
 * and type anything before the lobby starts filling in the background.
 */
import { io } from 'socket.io-client'

const URL = import.meta.env?.VITE_MATCHMAKING_URL ?? 'http://localhost:3000'
const GUEST_NAME_KEY = 'dino-mm-guest-name'

let socket = null
let autoJoinStarted = false

const initialState = {
  // idle | connecting | lobby | countdown | starting | error
  status: 'idle',
  lobbyId: null,
  playerId: null,
  players: [],
  playerCount: 0,
  maxPlayers: 8,
  lobbyStatus: null,
  countdown: null,
  error: null,
}

let state = { ...initialState }

const subscribers = new Set()

function update(patch) {
  state = { ...state, ...patch }
  subscribers.forEach((fn) => fn(state))
}

export function subscribeMatchmaking(fn) {
  subscribers.add(fn)
  fn(state)
  return () => subscribers.delete(fn)
}

export function getMatchmakingState() {
  return state
}

/**
 * Where everyone in the lobby actually is, right now.
 *
 * Kept out of `state` on purpose: a move arrives many times a second per
 * player, and running that through `update()` would re-render every
 * subscriber's React tree at network rate just to move a standee. This is a
 * plain mutable map instead - `OtherPlayers` reads it straight from its own
 * useFrame, the same way the local player's own position is a plain object
 * rather than store state.
 */
const livePositions = new Map()

export function getLivePositions() {
  return livePositions
}

/**
 * A swing, right now, from one specific lobby-mate.
 *
 * Kept separate from `livePositions` because it isn't state to converge on -
 * it's a moment. Each entry is overwritten with an incrementing `seq` so a
 * receiver can tell "a new swing happened" apart from "the old one is still
 * sitting there", the same distinction a socket event would give for free
 * were this not deliberately routed around React state (see above).
 */
const attackPulses = new Map()
let attackSeq = 0

export function getAttackPulses() {
  return attackPulses
}

function applyLobbyData(lobby) {
  if (!lobby) return
  const players = lobby.players ?? []

  update({
    lobbyId: lobby.lobbyId,
    players,
    playerCount: lobby.playerCount ?? 0,
    maxPlayers: lobby.maxPlayers ?? 8,
    lobbyStatus: lobby.status ?? null,
  })

  // Seed anyone new with their last-known spot so they don't pop in at the
  // origin before their first `player_moved` arrives; never stomp a position
  // already being driven live by that event.
  const rosterIds = new Set(players.map((p) => p.id))
  for (const player of players) {
    if (!livePositions.has(player.id)) {
      livePositions.set(player.id, {
        x: player.x ?? 0,
        y: player.y ?? 0,
        z: player.z ?? 0,
        angle: player.angle ?? 0,
        moving: false,
        training: Boolean(player.training),
        inLobby: player.inLobby !== false,
        evolutionIndex: player.evolutionIndex ?? 0,
      })
    }
  }
  for (const id of livePositions.keys()) {
    if (!rosterIds.has(id)) livePositions.delete(id)
  }
}

function teardownSocket() {
  if (!socket) return
  socket.removeAllListeners()
  socket.disconnect()
  socket = null
}

function randomGuestName() {
  return `Dino${Math.floor(1000 + Math.random() * 9000)}`
}

/**
 * A name to matchmake under without ever prompting for one: whatever the
 * player already set (Settings' leaderboard name), otherwise a guest tag
 * that's generated once and then kept stable across reloads.
 */
export function resolveAutoName(preferred) {
  const trimmed = String(preferred ?? '').trim()
  if (trimmed) return trimmed.slice(0, 16)

  try {
    const stored = window.localStorage?.getItem(GUEST_NAME_KEY)
    if (stored) return stored
    const generated = randomGuestName()
    window.localStorage?.setItem(GUEST_NAME_KEY, generated)
    return generated
  } catch {
    return randomGuestName()
  }
}

/** Join matchmaking automatically, once, as soon as the app is ready. */
export function autoJoin(preferredName) {
  if (autoJoinStarted) return
  autoJoinStarted = true
  findMatch(resolveAutoName(preferredName))
}

/** Open the connection (if needed) and enter the queue as `username`. */
export function findMatch(username) {
  const name = String(username ?? '').trim().slice(0, 16) || randomGuestName()

  if (socket) teardownSocket()

  livePositions.clear()
  attackPulses.clear()
  update({ ...initialState, status: 'connecting' })

  socket = io(URL, {
    autoConnect: false,
    reconnection: false,
    transports: ['websocket', 'polling'],
  })

  socket.on('connect', () => {
    socket.emit('join_matchmaking', { username: name })
  })

  socket.on('match_found', ({ lobbyId, playerId }) => {
    update({ status: 'lobby', lobbyId, playerId, countdown: null })
  })

  socket.on('lobby_updated', (lobby) => {
    applyLobbyData(lobby)
  })

  socket.on('lobby_full', () => {
    update({ status: 'countdown' })
  })

  socket.on('game_countdown', ({ count }) => {
    update({ status: 'countdown', countdown: count })
  })

  socket.on('game_start', () => {
    update({ status: 'starting', countdown: null })
  })

  socket.on('player_left', () => {
    // `lobby_updated` follows right behind with the authoritative roster.
  })

  socket.on('player_moved', (data) => {
    if (!data?.id) return
    livePositions.set(data.id, {
      x: data.x,
      y: data.y,
      z: data.z,
      angle: data.angle,
      moving: Boolean(data.moving),
      training: Boolean(data.training),
      inLobby: data.inLobby !== false,
      evolutionIndex: Number.isInteger(data.evolutionIndex) ? data.evolutionIndex : 0,
    })
  })

  socket.on('player_attacked', (data) => {
    if (!data?.id) return
    attackPulses.set(data.id, { crit: Boolean(data.crit), seq: ++attackSeq })
  })

  socket.on('error_message', (payload) => {
    update({ status: 'error', error: payload?.message ?? 'Matchmaking error.' })
  })

  socket.on('connect_error', () => {
    update({ status: 'error', error: 'Could not reach the game server.' })
  })

  socket.on('disconnect', () => {
    if (state.status !== 'idle') {
      livePositions.clear()
      attackPulses.clear()
      update({ ...initialState, status: 'error', error: 'Lost connection to the server.' })
    }
  })

  socket.connect()
}

/**
 * Broadcast this player's own position to the rest of the lobby.
 *
 * `y` is the actual height (feet on the ground or mid-jump) - without it
 * every lobby-mate's jump was invisible to everyone else, since only x/z/facing
 * ever crossed the wire. `training` covers the other case x/z can't: legs
 * still have to work on a treadmill even though the player isn't going
 * anywhere. `inLobby` says which coordinate space x/z are in: hub-local
 * (needs the hub's world offset added before rendering) or arena-native world
 * space (already directly usable). `evolutionIndex` is which stage's dino
 * this player is wearing, so lobby-mates render the real thing instead of a
 * generic placeholder - see `OtherPlayers.jsx`.
 */
export function sendPosition(x, y, z, angle, moving, training, inLobby, evolutionIndex) {
  if (!socket?.connected) return
  socket.emit('player_move', { x, y, z, angle, moving, training, inLobby, evolutionIndex })
}

/**
 * Announce one swing to the lobby - a manual click or an auto-fight tick,
 * whichever just landed locally. Fire-and-forget, not throttled with the
 * position tick: a swing is quick enough that a 10Hz sample could miss it
 * outright, so it gets its own event instead of riding along as state.
 */
export function sendAttack(crit) {
  if (!socket?.connected) return
  socket.emit('player_attack', { crit: Boolean(crit) })
}

/** Leave the current lobby/queue and close the connection. */
export function leaveMatch() {
  if (socket?.connected) {
    socket.emit('leave_lobby')
  }
  teardownSocket()
  livePositions.clear()
  attackPulses.clear()
  update({ ...initialState })
}

/**
 * Minimal read-only leaderboard server for the optional multiplayer stretch.
 *
 *   npm run server                 # ws://localhost:8787
 *   PORT=9000 ROOMS=1 npm run server
 *
 * Clients publish their own totals every few seconds; the server keeps the top
 * scores per room in memory and broadcasts the board back. There is no combat
 * sync and no persistence - restarting the process clears the board.
 *
 * Scores are self-reported, so this is a friendly scoreboard, not an
 * authoritative ranking. Anything stricter needs server-side simulation.
 */
import { WebSocketServer } from 'ws'
import { randomUUID } from 'node:crypto'

const PORT = Number(process.env.PORT) || 8787
const MAX_ENTRIES = 25
const BROADCAST_INTERVAL_MS = 2000
const MAX_MESSAGE_BYTES = 2048

/** room -> Map<clientId, entry> */
const rooms = new Map()

function getRoom(name) {
  if (!rooms.has(name)) rooms.set(name, new Map())
  return rooms.get(name)
}

function sanitiseName(value) {
  return String(value ?? '')
    .replace(/[^\p{L}\p{N} _\-.]/gu, '')
    .trim()
    .slice(0, 16)
}

function clampNumber(value, max = 1e15) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(Math.floor(n), max)
}

function boardFor(roomName) {
  const room = getRoom(roomName)
  return [...room.values()]
    .sort((a, b) => b.rebirths - a.rebirths || b.wins - a.wins)
    .slice(0, MAX_ENTRIES)
}

const wss = new WebSocketServer({ port: PORT })

wss.on('connection', (socket) => {
  const id = randomUUID()
  let roomName = 'global'
  socket.isAlive = true
  // The broadcast loop iterates wss.clients, so the room has to live on the
  // socket itself rather than only in this closure.
  socket.roomName = roomName

  socket.on('pong', () => {
    socket.isAlive = true
  })

  socket.on('message', (raw) => {
    if (raw.length > MAX_MESSAGE_BYTES) return

    let message
    try {
      message = JSON.parse(raw.toString())
    } catch {
      return
    }

    if (message?.type === 'join') {
      const next = sanitiseName(message.room) || 'global'
      if (next !== roomName) {
        getRoom(roomName).delete(id)
        roomName = next
        socket.roomName = roomName
      }
      socket.send(JSON.stringify({ type: 'board', room: roomName, entries: boardFor(roomName) }))
      return
    }

    if (message?.type === 'score') {
      getRoom(roomName).set(id, {
        id,
        name: sanitiseName(message.name) || 'Anonymous Dino',
        wins: clampNumber(message.wins),
        rebirths: clampNumber(message.rebirths, 100000),
        bestStage: clampNumber(message.bestStage, 10000),
      })
    }
  })

  socket.on('close', () => {
    getRoom(roomName).delete(id)
  })
})

// Push the board to everyone on a fixed cadence rather than on every update,
// so one fast-clicking client cannot spam the room.
const broadcast = setInterval(() => {
  const payloads = new Map()
  for (const client of wss.clients) {
    if (client.readyState !== client.OPEN) continue
    const room = client.roomName ?? 'global'
    if (!payloads.has(room)) {
      payloads.set(room, JSON.stringify({ type: 'board', room, entries: boardFor(room) }))
    }
    client.send(payloads.get(room))
  }
}, BROADCAST_INTERVAL_MS)

// Drop clients that stopped responding so their scores leave the board.
const heartbeat = setInterval(() => {
  for (const client of wss.clients) {
    if (!client.isAlive) {
      client.terminate()
      continue
    }
    client.isAlive = false
    client.ping()
  }
}, 30000)

wss.on('close', () => {
  clearInterval(broadcast)
  clearInterval(heartbeat)
})

console.log(`[dino] leaderboard server listening on ws://localhost:${PORT}`)

import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import { arenaGroundHeight } from '../data/arena.js'
import { EVOLUTIONS } from '../data/evolutions.js'
import { groundHeightAt } from '../data/lobby.js'
import { useGameStore } from '../store/useGameStore.js'
import { EVENTS, on } from '../systems/events.js'
import { playerActivity, playerFacing, playerPosition } from '../systems/playerState.js'
import {
  autoJoin,
  getAttackPulses,
  getLivePositions,
  getMatchmakingState,
  sendAttack,
  sendPosition,
  subscribeMatchmaking,
} from '../systems/matchmaking.js'
import DinoModel, { animateDinoRig, useDinoMaterials, useDinoRig } from './DinoModel.jsx'
import HeadlineText from './HeadlineText.jsx'

/**
 * Everyone else sharing your matchmaking lobby, walking, training and
 * attacking around with you in real time - wherever they actually are, hub or
 * arena corridor, because both halves of the game are one continuous world
 * (see `LOBBY_Z_OFFSET` / `chamberOrigin`). Each `player_move` is tagged
 * `inLobby` so a receiver knows which coordinate space it was sent in: hub
 * position is chamber-local and needs the hub's world offset added before it
 * matches the arena's own world space, which is already absolute.
 *
 * This component does three jobs, kept together because all three are "this
 * player's presence to the rest of the lobby":
 *  - it starts matchmaking (there's no button for it anywhere) and throttles
 *    out this player's own position/facing/activity, in whichever scene
 *    they're in;
 *  - it forwards one-shot swing events (a click, an auto-fight tick) the
 *    moment they happen - too quick to trust to the throttled position tick;
 *  - it renders every other lobby member at their live position and pose,
 *    read each frame from `getLivePositions()`/`getAttackPulses()`
 *    (matchmaking.js) rather than from React state, so a network update never
 *    triggers a re-render - only the Three.js transform moves, exactly like
 *    the local player's own dino.
 *
 * Each lobby-mate's real evolution tier is synced too, so they show up as the
 * actual dino they're wearing rather than a generic placeholder. Nothing
 * about their actual run (stats, upgrades) is synced - only appearance,
 * position, facing, and what their body is doing (walking, training,
 * swinging) is real.
 */
const SEND_INTERVAL = 0.1 // 10Hz - plenty for a decorative standee
const MOVE_EPSILON = 0.02
const LERP_SPEED = 8
// A jump bigger than this is a scene crossing (hub <-> arena), not travel -
// snap to it instead of sliding a lobby-mate across the whole world.
const SNAP_DISTANCE = 15
// Matches the local player's own treadmill beat (see Player.jsx) - lobby-mates
// training aren't phase-locked to the sender, but the same rhythm reads fine.
const TRAIN_SWING_INTERVAL = 0.55

function OtherPlayer({ id, username, worldOffset }) {
  // Only re-rendered when the evolution actually changes (equip, rebirth) -
  // everything else about this dino is driven imperatively below.
  const [evolutionIndex, setEvolutionIndex] = useState(0)
  const evolution = EVOLUTIONS[evolutionIndex] ?? EVOLUTIONS[0]
  const materials = useDinoMaterials(evolution)
  const rig = useDinoRig()
  const root = useRef()
  const tilt = useRef()
  const anim = useRef({ stride: 0, speed: 0, lunge: 0, sinceSwing: 0 })
  const smoothed = useRef(null) // null until the first live sample lands
  const lastAttackSeq = useRef(0)

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const live = getLivePositions().get(id)
    if (!live) return

    if (
      Number.isInteger(live.evolutionIndex) &&
      live.evolutionIndex !== evolutionIndex &&
      live.evolutionIndex >= 0 &&
      live.evolutionIndex < EVOLUTIONS.length
    ) {
      setEvolutionIndex(live.evolutionIndex)
    }

    const inLobby = live.inLobby !== false
    const targetX = inLobby ? live.x + worldOffset[0] : live.x
    const targetZ = inLobby ? live.z + worldOffset[2] : live.z
    // Real height when it's on hand (mid-jump included) - a ground lookup is
    // only a fallback for a lobby-mate whose first update hasn't arrived yet.
    const fallbackY = inLobby ? groundHeightAt(live.x, live.z) : arenaGroundHeight()
    const targetY = Number.isFinite(live.y) ? live.y + (inLobby ? worldOffset[1] : 0) : fallbackY

    if (!smoothed.current) {
      smoothed.current = { x: targetX, y: targetY, z: targetZ, angle: live.angle }
    } else {
      const jump = Math.hypot(targetX - smoothed.current.x, targetZ - smoothed.current.z)
      if (jump > SNAP_DISTANCE) {
        smoothed.current = { x: targetX, y: targetY, z: targetZ, angle: live.angle }
      } else {
        const t = Math.min(1, delta * LERP_SPEED)
        smoothed.current.x += (targetX - smoothed.current.x) * t
        smoothed.current.y += (targetY - smoothed.current.y) * t
        smoothed.current.z += (targetZ - smoothed.current.z) * t
        // Shortest-path angle lerp, so facing never spins the long way round.
        let da = live.angle - smoothed.current.angle
        da = Math.atan2(Math.sin(da), Math.cos(da))
        smoothed.current.angle += da * t
      }
    }

    // A treadmill runs the legs without going anywhere, same as the local
    // player's own controller.
    const moving = Boolean(live.moving)
    const training = Boolean(live.training)
    const working = moving || training

    if (training) {
      anim.current.sinceSwing += delta
      if (anim.current.sinceSwing >= TRAIN_SWING_INTERVAL) {
        anim.current.sinceSwing -= TRAIN_SWING_INTERVAL
        anim.current.lunge = 1
      }
    } else {
      anim.current.sinceSwing = 0
    }

    // A swing that arrived since last frame - never re-trigger on the same one.
    const pulse = getAttackPulses().get(id)
    if (pulse && pulse.seq > lastAttackSeq.current) {
      lastAttackSeq.current = pulse.seq
      anim.current.lunge = pulse.crit ? 1.35 : 1
    }

    anim.current.speed += ((working ? 1 : 0) - anim.current.speed) * Math.min(1, delta * 12)
    anim.current.stride += delta * (2.4 + anim.current.speed * 8)
    animateDinoRig(rig.current, anim.current.speed, anim.current.stride)

    anim.current.lunge = Math.max(0, anim.current.lunge - delta * 5.2)
    const lunge = anim.current.lunge * anim.current.lunge

    const { x, y, z, angle } = smoothed.current
    if (root.current) {
      // Step into the swing, along whatever way the dino is facing - same
      // formula the local player's own controller uses.
      root.current.position.set(
        x + Math.cos(angle) * lunge * 0.5,
        y,
        z - Math.sin(angle) * lunge * 0.5
      )
      root.current.rotation.y = angle
    }
    if (tilt.current) {
      tilt.current.rotation.z = -lunge * 0.16
      tilt.current.scale.setScalar(evolution.scale * (1 - lunge * 0.05))
    }
  })

  return (
    <group ref={root}>
      <group ref={tilt} scale={evolution.scale}>
        {/* No shadow: a full lobby is up to seven of these on screen at once,
            and the shadow pass is the single most expensive thing a dino
            costs (see quality.js) for a shadow nobody is looking at. */}
        <DinoModel evolution={evolution} materials={materials} rig={rig} castShadows={false} />
      </group>
      <Billboard position={[0, evolution.scale * 2.3 + 0.7, 0]} follow>
        <HeadlineText size={0.32} color="#bff2ff">
          {username}
        </HeadlineText>
      </Billboard>
    </group>
  )
}

export default function OtherPlayers({ worldOffset = [0, 0, 0] }) {
  const [mm, setMm] = useState(getMatchmakingState)
  const lastSent = useRef(null)

  useEffect(() => subscribeMatchmaking(setMm), [])

  // Starts matchmaking automatically - there's no button for it anywhere.
  useEffect(() => {
    autoJoin(useGameStore.getState().playerName)
  }, [])

  // A swing is a moment, not state - forward it the instant it happens rather
  // than waiting for the next throttled position tick to (maybe) catch it.
  // `source === 'click'` covers auto-fight too: both route through the same
  // `attack` action (see useGameStore.js), so this is exactly the set of
  // swings the local player themselves sees animate.
  useEffect(() => on(EVENTS.HIT, ({ source, crit }) => {
    if (source === 'click') sendAttack(crit)
  }), [])

  useFrame((state) => {
    const now = state.clock.elapsedTime
    const prev = lastSent.current
    if (prev != null && now - prev.t < SEND_INTERVAL) return

    const inLobby = useGameStore.getState().scene === 'lobby'
    const x = playerPosition.x
    const y = playerPosition.y
    const z = playerPosition.z
    const angle = playerFacing.angle
    // A scene crossing changes coordinate space, which reads as a huge jump -
    // never call that "moving" or a lobby-mate's standee lurches trying to
    // walk it (the receiver's own snap threshold covers the crossing itself).
    const moving =
      prev != null && prev.inLobby === inLobby && Math.hypot(x - prev.x, z - prev.z) > MOVE_EPSILON
    const training = playerActivity.training

    lastSent.current = { x, z, inLobby, t: now }
    const evolutionIndex = useGameStore.getState().evolutionIndex
    sendPosition(x, y, z, angle, moving, training, inLobby, evolutionIndex)
  })

  const others = mm.players.filter((player) => player.id !== mm.playerId)

  return (
    <>
      {others.map((player) => (
        <OtherPlayer
          key={player.id}
          id={player.id}
          username={player.username}
          worldOffset={worldOffset}
        />
      ))}
    </>
  )
}

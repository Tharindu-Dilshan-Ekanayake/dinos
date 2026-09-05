import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  ARENA_BOUNDS,
  ARENA_PLAYER_SPAWN,
  ARENA_PLAYER_SPEED,
  ARENA_PLAYER_TURN_SPEED,
  PASSAGE_HALF_WIDTH,
  PASSAGE_LENGTH,
  arenaGroundHeight,
  chamberOrigin,
} from '../../data/arena.js'
import { EVOLUTIONS } from '../../data/evolutions.js'
import { useGameStore } from '../../store/useGameStore.js'
import { EVENTS, on } from '../../systems/events.js'
import { createStepper } from '../../systems/footsteps.js'
import { installInput } from '../../systems/input.js'
import { stepPlayer, turnToward } from '../../systems/playerMovement.js'
import { placePlayer, playerFacing, playerMotion, playerPosition } from '../../systems/playerState.js'
import { enemySlots, packState } from '../../systems/arenaEnemies.js'
import { getTimeScale } from '../../systems/timeScale.js'
import DinoModel, { animateDinoRig, useDinoMaterials, useDinoRig } from '../DinoModel.jsx'

/**
 * Bounds move with the corridor.
 *
 * They are anchored to the chamber the player is currently credited with, and
 * reach a passage-length past it at both ends. That slack is what makes the
 * corridor seamless: the moment a boundary is crossed the anchor jumps a whole
 * chamber, and without the overlap the clamp would yank the dino back into the
 * level it just left.
 */
const bounds = { ...ARENA_BOUNDS }
const CONFIG = {
  speed: ARENA_PLAYER_SPEED,
  turnSpeed: ARENA_PLAYER_TURN_SPEED,
  bounds,
  obstacles: null,
  groundHeightAt: arenaGroundHeight,
}

/**
 * The dino you control in the arena.
 *
 * Same controller as the hub - WASD or the stick to walk, Space to jump,
 * resolved against the orbit camera - with two additions: it snaps to face
 * whatever it is attacking, and it lunges on every hit.
 */
export default function ArenaPlayer() {
  const evolutionIndex = useGameStore((s) => s.evolutionIndex)
  const evolution = EVOLUTIONS[evolutionIndex] ?? EVOLUTIONS[0]
  const materials = useDinoMaterials(evolution)

  const root = useRef()
  const scaler = useRef()
  const rig = useDinoRig()
  const anim = useRef({ stride: 0, speed: 0, lunge: 0, glow: 0, death: 0 })
  // Footfalls are sized by the dino you are wearing, so evolving is something
  // you hear as well as see.
  const step = useMemo(() => createStepper({ scale: evolution.scale }), [evolution.scale])

  useEffect(() => installInput(), [])

  // Drop in at the front of the level the run starts on.
  useEffect(() => {
    const origin = chamberOrigin(useGameStore.getState().stageIndex)
    placePlayer(
      [ARENA_PLAYER_SPAWN[0], ARENA_PLAYER_SPAWN[1], origin + ARENA_PLAYER_SPAWN[2]],
      Math.PI / 2
    )
  }, [])

  useEffect(() => {
    const unsubscribers = [
      on(EVENTS.HIT, ({ source, crit }) => {
        if (source !== 'click') return
        anim.current.lunge = crit ? 1.35 : 1
      }),
      on(EVENTS.EVOLVE, () => {
        anim.current.glow = 1
      }),
      on(EVENTS.REBIRTH, () => {
        anim.current.glow = 1
      }),
      // Walking into a level you cannot survive.
      on(EVENTS.DEATH, () => {
        anim.current.death = 1
      }),
      // Crossing into a new level must NOT move the dino: you walked here, and
      // the chambers are laid end to end so you simply keep going. The only
      // repositioning is a fresh run, handled on mount.
      on(EVENTS.STAGE_ENTER, ({ fresh }) => {
        anim.current.death = 0
        if (!fresh) return
        const origin = chamberOrigin(useGameStore.getState().stageIndex)
        placePlayer(
          [ARENA_PLAYER_SPAWN[0], ARENA_PLAYER_SPAWN[1], origin + ARENA_PLAYER_SPAWN[2]],
          Math.PI / 2
        )
      }),
      on(EVENTS.RESPAWN, () => {
        anim.current.death = 0
      }),
    ]
    return () => unsubscribers.forEach((off) => off())
  }, [])

  useFrame((_, rawDelta) => {
    const a = anim.current
    const delta = Math.min(rawDelta, 0.05)
    const scaled = delta * getTimeScale()

    const { stageCleared, dead, stageIndex } = useGameStore.getState()
    const origin = chamberOrigin(stageIndex)
    const localZ = playerPosition.z - origin

    // Sealed barrier holds you in until the pack is down; once it opens the
    // bounds reach forward into the passage toward the next chamber.
    const beyondBack = localZ < ARENA_BOUNDS.minZ
    bounds.minX = ARENA_BOUNDS.minX
    bounds.maxX = ARENA_BOUNDS.maxX
    bounds.minZ =
      stageCleared || beyondBack
        ? origin + ARENA_BOUNDS.minZ - PASSAGE_LENGTH
        : origin + ARENA_BOUNDS.minZ
    /*
     * Backwards there is always somewhere to go - every level behind you this
     * run is cleared ground you are allowed to walk back over. Stage 1 is the
     * exception: nothing stands behind it but the way out, so the corridor
     * simply stops at its near wall and the mouth of the arena is a step, not
     * a stretch of empty floor to wander into.
     */
    bounds.maxZ =
      stageIndex > 0
        ? origin + ARENA_BOUNDS.maxZ + PASSAGE_LENGTH
        : origin + ARENA_BOUNDS.maxZ

    // A dying dino stops taking input.
    const { moving } = dead ? { moving: false } : stepPlayer(delta, CONFIG)

    // The passage between chambers is only as wide as the gap in the back
    // wall, so squeeze the dino into it rather than letting them walk through
    // solid terrace.
    const localAfter = playerPosition.z - origin
    if (localAfter < ARENA_BOUNDS.minZ || localAfter > ARENA_BOUNDS.maxZ) {
      playerPosition.x = Math.min(
        PASSAGE_HALF_WIDTH,
        Math.max(-PASSAGE_HALF_WIDTH, playerPosition.x)
      )
    }

    // Face the enemy you are fighting whenever you are not steering elsewhere,
    // so attacks always read as aimed at something.
    if (!moving && packState.targetSlot >= 0) {
      const target = enemySlots[packState.targetSlot]
      const dx = target.x - playerPosition.x
      const dz = target.z - playerPosition.z
      if (Math.hypot(dx, dz) > 0.2) turnToward(Math.atan2(-dz, dx), delta, 6)
    }

    a.speed += ((moving ? 1 : 0) - a.speed) * Math.min(1, delta * 12)
    a.stride += delta * (2.4 + a.speed * 8)
    animateDinoRig(rig.current, a.speed, a.stride)
    if (!dead) step(a.stride, a.speed, { grounded: playerMotion.grounded })

    a.lunge = Math.max(0, a.lunge - scaled * 5.2)
    const lunge = a.lunge * a.lunge

    if (root.current) {
      // Step into the swing, along whatever way the dino is facing.
      root.current.position.set(
        playerPosition.x + Math.cos(playerFacing.angle) * lunge * 0.55,
        playerPosition.y,
        playerPosition.z - Math.sin(playerFacing.angle) * lunge * 0.55
      )
      root.current.rotation.y = playerFacing.angle
      // Tip forward in the air so the jump reads as an arc, not an elevator.
      root.current.rotation.z = playerMotion.grounded
        ? -lunge * 0.14
        : -playerMotion.velocityY * 0.012
    }

    if (scaler.current) {
      scaler.current.scale.setScalar(evolution.scale * (1 - lunge * 0.05))
    }

    a.glow = Math.max(0, a.glow - delta / 1.5)
    const glow = a.glow * a.glow
    materials.body.emissive.setHex(0xffc83d)
    materials.body.emissiveIntensity = glow * 1.9

    // Death: topple over and sink, then hold until the player respawns.
    if (dead && a.death > 0) a.death = Math.max(0.001, a.death - delta / 0.9)
    if (root.current) {
      const fallen = dead ? 1 - a.death : 0
      root.current.rotation.z += (fallen * 1.5 - root.current.rotation.z) * Math.min(1, delta * 6)
      if (dead) root.current.position.y = playerPosition.y - fallen * 0.35
    }
  })

  return (
    <group ref={root} position={ARENA_PLAYER_SPAWN}>
      <group ref={scaler} scale={evolution.scale}>
        <DinoModel evolution={evolution} materials={materials} rig={rig} />
      </group>
    </group>
  )
}

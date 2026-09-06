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
 * Going down.
 *
 * A death used to be one lerp: the dino rotated 86 degrees onto its tail over
 * nine tenths of a second and sank a little, which read as a model being
 * rotated rather than as an animal being killed. A fall is three things -
 * something hits you, you go over, and then you land - and the last of them is
 * the one that sells it, because it is the only moment with any weight in it.
 *
 * The whole thing fits inside DeathReturn's wait, so the hub never cuts in
 * over a dino still falling.
 */
const DEATH_SECONDS = 1
/** The stagger: it rocks back and the head comes up, but it is still standing. */
const DEATH_STAGGER = 0.24
/** By here it is on the ground, and everything after is settling. */
const DEATH_TOPPLE = 0.66

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
  const anim = useRef({ stride: 0, speed: 0, lunge: 0, glow: 0, fell: 0 })
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
      // Crossing into a new level must NOT move the dino: you walked here, and
      // the chambers are laid end to end so you simply keep going. The only
      // repositioning is a fresh run, handled on mount.
      on(EVENTS.STAGE_ENTER, ({ fresh }) => {
        if (!fresh) return
        const origin = chamberOrigin(useGameStore.getState().stageIndex)
        placePlayer(
          [ARENA_PLAYER_SPAWN[0], ARENA_PLAYER_SPAWN[1], origin + ARENA_PLAYER_SPAWN[2]],
          Math.PI / 2
        )
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

    /*
     * Death, in three beats. The clock is driven off the store's own `dead`
     * rather than an event, so a respawn puts the dino back on its feet by
     * simply not being dead any more - there is no second copy of the state to
     * get out of step with it.
     */
    a.fell = dead ? Math.min(DEATH_SECONDS, a.fell + delta) : 0
    if (dead && root.current) {
      const f = a.fell

      // 1. The blow lands: it rocks back onto its heels, head thrown up.
      const rear = f < DEATH_STAGGER ? Math.sin((f / DEATH_STAGGER) * Math.PI) : 0

      // 2. It goes over sideways, accelerating the way a falling thing does
      //    rather than easing politely into place.
      const over = Math.min(1, Math.max(0, (f - DEATH_STAGGER) / (DEATH_TOPPLE - DEATH_STAGGER)))
      const drop = over * over

      // 3. And it hits the ground, which is the only part with weight in it.
      const bounce =
        f > DEATH_TOPPLE ? Math.sin(Math.min(1, (f - DEATH_TOPPLE) / 0.2) * Math.PI) : 0

      root.current.position.set(
        playerPosition.x - Math.cos(playerFacing.angle) * rear * 0.4,
        playerPosition.y + rear * 0.1 - drop * 0.4 + bounce * 0.05,
        playerPosition.z + Math.sin(playerFacing.angle) * rear * 0.4
      )
      // Onto its side, with a small rebound as it lands.
      root.current.rotation.x = drop * 1.55 - bounce * 0.14
      // Nose up while it staggers, then down as the weight goes.
      root.current.rotation.z = rear * 0.4 - drop * 0.22

      if (rig.current) {
        // The head is the last thing to give up, and the tail flops after it.
        if (rig.current.head) rig.current.head.rotation.z = rear * 0.7 - drop * 0.55
        if (rig.current.tail) {
          rig.current.tail.rotation.z = -drop * 0.45
          rig.current.tail.rotation.y = drop * 0.3
        }
        // Legs splay out from under it rather than staying mid-stride.
        const splay = drop * 0.7
        if (rig.current.legFrontL) rig.current.legFrontL.rotation.z = splay
        if (rig.current.legFrontR) rig.current.legFrontR.rotation.z = -splay * 0.6
        if (rig.current.legBackL) rig.current.legBackL.rotation.z = -splay * 0.8
        if (rig.current.legBackR) rig.current.legBackR.rotation.z = splay * 0.5
      }

      // Squashed by the landing, and the evolution glow goes out with it.
      if (scaler.current) {
        scaler.current.scale.set(
          evolution.scale * (1 + bounce * 0.09),
          evolution.scale * (1 - bounce * 0.13),
          evolution.scale * (1 + bounce * 0.09)
        )
      }
      materials.body.emissiveIntensity = 0
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

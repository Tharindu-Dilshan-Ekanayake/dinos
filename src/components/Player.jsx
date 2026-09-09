import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  ARENA,
  ARENA_BOUNDS,
  ARENA_PLAYER_SPEED,
  ARENA_PLAYER_TURN_SPEED,
  HUB_ARRIVAL_WORLD,
  HUB_BOUNDS,
  HUB_OBSTACLES,
  MOUTH_EXIT_Z,
  PASSAGE_HALF_WIDTH,
  PASSAGE_LENGTH,
  arenaGroundHeight,
  chamberOrigin,
  chamberSpawn,
  hubGroundHeight,
} from '../data/arena.js'
import { EVOLUTIONS } from '../data/evolutions.js'
import { PLAYER_SPEED, PLAYER_TURN_SPEED } from '../data/lobby.js'
import { useGameStore } from '../store/useGameStore.js'
import { EVENTS, on } from '../systems/events.js'
import { createStepper } from '../systems/footsteps.js'
import { installInput } from '../systems/input.js'
import { stepPlayer, turnToward } from '../systems/playerMovement.js'
import {
  placePlayer,
  playerActivity,
  playerFacing,
  playerMotion,
  playerPosition,
} from '../systems/playerState.js'
import { enemySlots, packState } from '../systems/arenaEnemies.js'
import { getTimeScale } from '../systems/timeScale.js'
import DinoModel, { animateDinoRig, useDinoMaterials, useDinoRig } from './DinoModel.jsx'

/**
 * Seconds between swings while training.
 *
 * Damage on a pad is earned by *working* for it, so the dino throws a blow on
 * a beat while it runs - the same motion an attack makes in the arena. Without
 * it a treadmill was a dino jogging politely while a number went up on its
 * own, which says nothing about where the number comes from.
 */
const TRAIN_SWING_INTERVAL = 0.55

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
 * The hub's walls and ground, in world numbers.
 *
 * The dino handles identically in both halves - same walk, same turn, same
 * jump arc - and the halves differ only in where the walls are and what the
 * floor does underneath. That difference is this object and the one below it,
 * not a second copy of the controller.
 */
const HUB_CONFIG = {
  speed: PLAYER_SPEED,
  turnSpeed: PLAYER_TURN_SPEED,
  bounds: HUB_BOUNDS,
  obstacles: HUB_OBSTACLES,
  groundHeightAt: hubGroundHeight,
}

/**
 * The corridor's, which move with it.
 *
 * Anchored to the chamber the player is currently credited with, reaching a
 * passage-length past it at both ends. That slack is what makes the corridor
 * seamless: the moment a boundary is crossed the anchor jumps a whole chamber,
 * and without the overlap the clamp would yank the dino back into the level it
 * just left.
 */
const arenaBounds = { ...ARENA_BOUNDS }
const ARENA_CONFIG = {
  speed: ARENA_PLAYER_SPEED,
  turnSpeed: ARENA_PLAYER_TURN_SPEED,
  bounds: arenaBounds,
  obstacles: null,
  groundHeightAt: arenaGroundHeight,
}

/**
 * The dino you control. One of them, for the whole world.
 *
 * There used to be two: a hub dino and an arena dino, each driving the same
 * shared position in its own half's coordinates, one visible at a time. The
 * gateway was where they swapped, and swapping is why crossing it kept reading
 * as a teleport however carefully the numbers were lined up - a position had to
 * be converted between two coordinate systems, a camera had to be told the
 * offset had changed, and two models had to be parked on each other so the
 * handover had nothing to show. None of that describes anything that happens to
 * a dino walking down a corridor.
 *
 * The position is world space now (see playerState.js) and the hub and the
 * corridor are one continuous floor, so there is nothing to hand over. What
 * changes at the gateway is which set of walls is being clamped against, and
 * which of these two configs answers the question - a config swap mid-stride,
 * on a dino that never stops walking.
 *
 * Input is WASD (or the touch joystick) resolved against the orbit camera's
 * facing, so W always walks away from the camera however it has been swung
 * around - the mouse steers the view, never the dino. Space jumps.
 */
export default function Player() {
  const evolutionIndex = useGameStore((s) => s.evolutionIndex)
  const evolution = EVOLUTIONS[evolutionIndex] ?? EVOLUTIONS[0]
  const materials = useDinoMaterials(evolution)

  const root = useRef()
  const scaler = useRef()
  const rig = useDinoRig()
  const anim = useRef({ stride: 0, speed: 0, lunge: 0, glow: 0, fell: 0, sinceSwing: 0 })
  // Footfalls are sized by the dino you are wearing, so evolving is something
  // you hear as well as see.
  const step = useMemo(() => createStepper({ scale: evolution.scale }), [evolution.scale])

  useEffect(() => installInput(), [])

  /*
   * Somewhere sensible to be standing, on the first frame of a session.
   *
   * Nothing saves a position, so a reload always starts the dino at the hub's
   * spawn - which is wrong if the save says the run was in the arena, and the
   * corridor runs thousands of units out along -Z from there. Only a load can
   * land here: within a session the dino walks everywhere it goes.
   */
  useEffect(() => {
    const { scene, stageIndex } = useGameStore.getState()
    if (scene !== 'arena') return
    placePlayer(chamberSpawn(stageIndex), Math.PI / 2)
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
    ]
    return () => unsubscribers.forEach((off) => off())
  }, [])

  useFrame((_, rawDelta) => {
    const a = anim.current
    const delta = Math.min(rawDelta, 0.05)
    const scaled = delta * getTimeScale()

    const { scene, stageCleared, dead, stageIndex } = useGameStore.getState()
    const inArena = scene === 'arena'

    let config = HUB_CONFIG
    if (inArena) {
      config = ARENA_CONFIG
      const origin = chamberOrigin(stageIndex)
      const localZ = playerPosition.z - origin

      // Sealed barrier holds you in until the pack is down; once it opens the
      // bounds reach forward into the passage toward the next chamber.
      const beyondBack = localZ < ARENA_BOUNDS.minZ
      arenaBounds.minZ =
        stageCleared || beyondBack
          ? origin + ARENA_BOUNDS.minZ - PASSAGE_LENGTH
          : origin + ARENA_BOUNDS.minZ
      /*
       * Backwards there is always somewhere to go - every level behind you this
       * run is cleared ground you are allowed to walk back over. Stage 1 is the
       * exception: nothing stands behind it but the way out, and that reaches
       * through the mouth and across the landing into the hub's own gateway,
       * because the two are the same floor.
       */
      arenaBounds.maxZ =
        stageIndex > 0
          ? origin + ARENA_BOUNDS.maxZ + PASSAGE_LENGTH
          : origin + MOUTH_EXIT_Z + 0.6
    }

    // A dying dino stops taking input.
    const { moving } = dead ? { moving: false } : stepPlayer(delta, config)

    if (inArena) {
      const origin = chamberOrigin(stageIndex)
      const localAfter = playerPosition.z - origin
      // The passage between chambers is only as wide as the gap in the back
      // wall, so squeeze the dino into it rather than letting them walk through
      // solid terrace.
      if (localAfter < ARENA_BOUNDS.minZ) {
        playerPosition.x = Math.min(
          PASSAGE_HALF_WIDTH,
          Math.max(-PASSAGE_HALF_WIDTH, playerPosition.x)
        )
      } else if (localAfter > ARENA_BOUNDS.maxZ) {
        /*
         * Past the chamber's front wall you are in the mouth, which is a doorway
         * the width of the hub's gateway - not the width of the arena.
         */
        const gap = stageIndex > 0 ? PASSAGE_HALF_WIDTH : ARENA.gapHalfWidth
        playerPosition.x = Math.min(gap, Math.max(-gap, playerPosition.x))
      }
    }
    /*
     * The hub needs no matching squeeze. Its gateway walls are in the obstacle
     * list as circles and push the dino out of themselves, and its bounds stop
     * three units short of where the paving ends in any case.
     */

    /*
     * In the arena: face the enemy you are fighting whenever you are not
     * steering elsewhere, so attacks always read as aimed at something.
     * In the hub: a treadmill is the one place the dino works without going
     * anywhere, so it turns to face down the belt and swings on a beat.
     */
    const training = !inArena && playerActivity.training

    if (inArena && !moving && packState.targetSlot >= 0) {
      const target = enemySlots[packState.targetSlot]
      const dx = target.x - playerPosition.x
      const dz = target.z - playerPosition.z
      if (Math.hypot(dx, dz) > 0.2) turnToward(Math.atan2(-dz, dx), delta, 6)
    } else if (training && !moving) {
      // Face down the belt, which runs across the row toward the walkway - so
      // training faces the dino into the hub rather than out at the fence.
      turnToward(Math.PI, delta, 4)
    }

    if (training) {
      a.sinceSwing += delta
      if (a.sinceSwing >= TRAIN_SWING_INTERVAL) {
        a.sinceSwing -= TRAIN_SWING_INTERVAL
        a.lunge = 1
      }
    } else {
      a.sinceSwing = 0
    }

    // The legs are driven by effort, not by travel: standing still on a pad
    // used to leave the dino idle while the belt scrolled under its feet.
    const working = moving || training
    a.speed += ((working ? 1 : 0) - a.speed) * Math.min(1, delta * 12)
    a.stride += delta * (2.4 + a.speed * 8)
    animateDinoRig(rig.current, a.speed, a.stride)
    if (!dead) step(a.stride, a.speed, { grounded: playerMotion.grounded })

    a.lunge = Math.max(0, a.lunge - scaled * 5.2)
    // Squared, so a blow snaps out and eases back rather than sliding.
    const lunge = a.lunge * a.lunge

    if (root.current) {
      // Step into the swing, along whatever way the dino is facing.
      root.current.position.set(
        playerPosition.x + Math.cos(playerFacing.angle) * lunge * 0.55,
        playerPosition.y,
        playerPosition.z - Math.sin(playerFacing.angle) * lunge * 0.55
      )
      root.current.rotation.set(
        0,
        playerFacing.angle,
        // Tip forward in the air so the jump reads as an arc, not an elevator.
        playerMotion.grounded ? -lunge * 0.14 : -playerMotion.velocityY * 0.012
      )
    }

    if (scaler.current) {
      scaler.current.scale.setScalar(evolution.scale * (1 - lunge * 0.05))
      // A slight roll while running, so a walk is not perfectly rigid.
      scaler.current.rotation.x = a.speed * 0.05
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
        scaler.current.rotation.x = 0
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
    <group ref={root} position={HUB_ARRIVAL_WORLD.position}>
      <group ref={scaler} scale={evolution.scale}>
        <DinoModel evolution={evolution} materials={materials} rig={rig} />
      </group>
    </group>
  )
}

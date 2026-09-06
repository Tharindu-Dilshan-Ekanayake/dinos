import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { EVOLUTIONS } from '../../data/evolutions.js'
import {
  ARENA_GATE,
  OBSTACLES,
  PLAYER_BOUNDS,
  PLAYER_SPEED,
  PLAYER_TURN_SPEED,
  groundHeightAt,
} from '../../data/lobby.js'
import { useGameStore } from '../../store/useGameStore.js'
import { createStepper } from '../../systems/footsteps.js'
import { installInput } from '../../systems/input.js'
import { stepPlayer, turnToward } from '../../systems/playerMovement.js'
import {
  playerActivity,
  playerFacing,
  playerMotion,
  playerPosition,
} from '../../systems/playerState.js'
import DinoModel, { animateDinoRig, useDinoMaterials, useDinoRig } from '../DinoModel.jsx'

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
 * The walkable dino you control in the hub.
 *
 * Movement is a plain kinematic step clamped to the plaza and pushed out of a
 * short list of prop circles, rather than a physics body: the hub has no
 * dynamic obstacles, and keeping the player out of Rapier means the whole
 * lobby runs without stepping a physics world.
 *
 * Input is WASD (or the touch joystick) resolved against the orbit camera's
 * facing, so W always walks away from the camera however it has been swung
 * around - the mouse steers the view, never the dino. Space jumps.
 *
 * The step itself lives in systems/playerMovement.js, shared with the arena,
 * so the dino handles identically in both halves of the game.
 */
const CONFIG = {
  speed: PLAYER_SPEED,
  turnSpeed: PLAYER_TURN_SPEED,
  bounds: PLAYER_BOUNDS,
  obstacles: OBSTACLES,
  groundHeightAt,
}

export default function Player() {
  const evolutionIndex = useGameStore((s) => s.evolutionIndex)
  const evolution = EVOLUTIONS[evolutionIndex] ?? EVOLUTIONS[0]
  const materials = useDinoMaterials(evolution)

  const root = useRef()
  const tilt = useRef()
  const rig = useDinoRig()
  const anim = useRef({ stride: 0, speed: 0, lunge: 0, sinceSwing: 0 })
  const step = useMemo(() => createStepper({ scale: evolution.scale }), [evolution.scale])

  useEffect(() => installInput(), [])

  /*
   * Arriving back from the arena, at the gate you left through.
   *
   * Nothing used to put the dino back when a run ended, and the arena's
   * corridor runs thousands of units out along -Z - so a player who walked
   * home, or died deep, stood in the void beside the hub with the camera out
   * there with them, until they happened to press a key and the plaza's bounds
   * snapped them back. Anything outside the plaza is put on the gate pad, and
   * stepped clear of it so the walk-in trigger does not fire again.
   */
  useEffect(() => {
    const outside =
      playerPosition.x < PLAYER_BOUNDS.minX ||
      playerPosition.x > PLAYER_BOUNDS.maxX ||
      playerPosition.z < PLAYER_BOUNDS.minZ ||
      playerPosition.z > PLAYER_BOUNDS.maxZ

    const dx = playerPosition.x - ARENA_GATE.position[0]
    const dz = playerPosition.z - ARENA_GATE.position[2]

    if (outside || Math.hypot(dx, dz) < ARENA_GATE.radius + 0.5) {
      playerPosition.set(
        ARENA_GATE.position[0],
        groundHeightAt(ARENA_GATE.position[0], ARENA_GATE.position[2] + ARENA_GATE.radius + 2.5),
        ARENA_GATE.position[2] + ARENA_GATE.radius + 2.5
      )
      playerFacing.angle = Math.PI / 2
      playerMotion.velocityY = 0
      playerMotion.grounded = true
    }
  }, [])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const { moving } = stepPlayer(delta, CONFIG)

    /*
     * A treadmill is the one place the dino works without going anywhere, so
     * the legs are driven by *effort* rather than by travel. Standing still on
     * a pad used to leave it in its idle pose while the belt scrolled under
     * its feet and the damage counter climbed - nothing on screen connected
     * the two.
     */
    const training = playerActivity.training
    const working = moving || training

    // Face down the belt, which now runs across the row toward the walkway -
    // so training faces the dino into the hub rather than out at the fence.
    // While you are not steering there is nothing to fight over.
    if (training && !moving) turnToward(Math.PI, delta, 4)

    anim.current.speed += ((working ? 1 : 0) - anim.current.speed) * Math.min(1, delta * 12)

    // Swinging on the beat while it runs, and the blow decaying between.
    if (training) {
      anim.current.sinceSwing += delta
      if (anim.current.sinceSwing >= TRAIN_SWING_INTERVAL) {
        anim.current.sinceSwing -= TRAIN_SWING_INTERVAL
        anim.current.lunge = 1
      }
    } else {
      anim.current.sinceSwing = 0
    }
    anim.current.lunge = Math.max(0, anim.current.lunge - delta * 5.2)

    // Stride advances faster the harder the dino is moving, so the legs keep
    // pace with the ground rather than sliding across it.
    anim.current.stride += delta * (2.4 + anim.current.speed * 8)
    animateDinoRig(rig.current, anim.current.speed, anim.current.stride)
    step(anim.current.stride, anim.current.speed, { grounded: playerMotion.grounded })

    // Squared, so a blow snaps out and eases back rather than sliding.
    const lunge = anim.current.lunge * anim.current.lunge

    if (root.current) {
      // Step into the swing, along whatever way the dino is facing.
      root.current.position.set(
        playerPosition.x + Math.cos(playerFacing.angle) * lunge * 0.5,
        playerPosition.y,
        playerPosition.z - Math.sin(playerFacing.angle) * lunge * 0.5
      )
      root.current.rotation.y = playerFacing.angle
    }
    if (tilt.current) {
      // Lean into the direction of travel, tip in the air so a jump reads as
      // an arc rather than an elevator ride, and drop the shoulder into a
      // swing the way the arena's dino does.
      tilt.current.rotation.x = anim.current.speed * 0.05
      tilt.current.rotation.z = playerMotion.grounded
        ? -lunge * 0.16
        : -playerMotion.velocityY * 0.012
      tilt.current.scale.setScalar(evolution.scale * (1 - lunge * 0.05))
    }
  })

  return (
    <group ref={root} position={[playerPosition.x, 0, playerPosition.z]}>
      <group ref={tilt} scale={evolution.scale}>
        <DinoModel evolution={evolution} materials={materials} rig={rig} />
      </group>
    </group>
  )
}

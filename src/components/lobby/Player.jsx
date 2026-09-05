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
import { stepPlayer } from '../../systems/playerMovement.js'
import { playerFacing, playerMotion, playerPosition } from '../../systems/playerState.js'
import DinoModel, { animateDinoRig, useDinoMaterials, useDinoRig } from '../DinoModel.jsx'

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
  const anim = useRef({ stride: 0, speed: 0 })
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

    anim.current.speed += ((moving ? 1 : 0) - anim.current.speed) * Math.min(1, delta * 12)

    // Stride advances faster the harder the dino is moving, so the legs keep
    // pace with the ground rather than sliding across it.
    anim.current.stride += delta * (2.4 + anim.current.speed * 8)
    animateDinoRig(rig.current, anim.current.speed, anim.current.stride)
    step(anim.current.stride, anim.current.speed, { grounded: playerMotion.grounded })

    if (root.current) {
      root.current.position.set(playerPosition.x, playerPosition.y, playerPosition.z)
      root.current.rotation.y = playerFacing.angle
    }
    if (tilt.current) {
      // Lean into the direction of travel, and tip in the air so a jump reads
      // as an arc rather than an elevator ride.
      tilt.current.rotation.x = anim.current.speed * 0.05
      tilt.current.rotation.z = playerMotion.grounded
        ? 0
        : -playerMotion.velocityY * 0.012
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

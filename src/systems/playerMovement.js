import { getCameraBasis } from './cameraOrbit.js'
import { consumeJump, getMoveVector } from './input.js'
import { playerFacing, playerMotion, playerPosition } from './playerState.js'

/**
 * One kinematic step of the walkable dino, shared by the hub and the arena.
 *
 * Both scenes want identical feel - the same walk speed, the same turn rate,
 * the same jump arc - and differ only in where the walls are and what the
 * ground height is under your feet. Those differences arrive as config rather
 * than as a second copy of this logic.
 *
 * There is no physics body here on purpose: neither scene has dynamic
 * obstacles, so clamping to bounds and pushing out of a short list of prop
 * circles is both cheaper and far more predictable than a character
 * controller in a physics world.
 */

/** Upward launch speed. Paired with GRAVITY this gives roughly a 2m hop. */
export const JUMP_SPEED = 11.5
export const GRAVITY = -32

/** How fast the dino settles onto a new ground height while walking. */
const GROUND_EASE = 12

const move = { x: 0, z: 0 }
const basis = { forwardX: 0, forwardZ: 0, rightX: 0, rightZ: 0 }

/**
 * Advance the player.
 *
 * @param delta   clamped frame delta in seconds
 * @param config  { speed, turnSpeed, bounds, obstacles, groundHeightAt, canJump }
 * @returns       { moving, airborne, jumped }
 */
export function stepPlayer(delta, config) {
  const {
    speed,
    turnSpeed,
    bounds,
    obstacles,
    groundHeightAt,
    canJump = true,
  } = config

  getMoveVector(move)
  getCameraBasis(basis)

  const moving = move.x !== 0 || move.z !== 0

  if (moving) {
    // move.z is -1 for "forward", so negate it onto the camera's forward axis.
    const worldX = basis.rightX * move.x + basis.forwardX * -move.z
    const worldZ = basis.rightZ * move.x + basis.forwardZ * -move.z

    playerPosition.x += worldX * speed * delta
    playerPosition.z += worldZ * speed * delta

    if (obstacles) {
      for (const obstacle of obstacles) {
        const dx = playerPosition.x - obstacle.x
        const dz = playerPosition.z - obstacle.z
        const distance = Math.hypot(dx, dz)
        if (distance > 0.0001 && distance < obstacle.radius) {
          const push = obstacle.radius / distance
          playerPosition.x = obstacle.x + dx * push
          playerPosition.z = obstacle.z + dz * push
        }
      }
    }

    playerPosition.x = Math.min(bounds.maxX, Math.max(bounds.minX, playerPosition.x))
    playerPosition.z = Math.min(bounds.maxZ, Math.max(bounds.minZ, playerPosition.z))

    // The model faces +X, so the yaw pointing it along the move vector is
    // atan2(-z, x).
    const desired = Math.atan2(-worldZ, worldX)
    turnToward(desired, delta, turnSpeed)
  }

  // --- vertical ---
  const surface = groundHeightAt ? groundHeightAt(playerPosition.x, playerPosition.z) : 0
  const wantsJump = consumeJump()
  let jumped = false

  if (playerMotion.grounded) {
    // Ease onto the surface so stepping up stairs does not jolt the camera.
    playerPosition.y += (surface - playerPosition.y) * Math.min(1, delta * GROUND_EASE)

    if (wantsJump && canJump) {
      playerMotion.velocityY = JUMP_SPEED
      playerMotion.grounded = false
      jumped = true
    }
  } else {
    playerMotion.velocityY += GRAVITY * delta
    playerPosition.y += playerMotion.velocityY * delta

    if (playerPosition.y <= surface) {
      playerPosition.y = surface
      playerMotion.velocityY = 0
      playerMotion.grounded = true
    }
  }

  return { moving, airborne: !playerMotion.grounded, jumped }
}

/** Rotate the dino toward `desired`, taking the short way round. */
export function turnToward(desired, delta, turnSpeed) {
  let diff = desired - playerFacing.angle
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  playerFacing.angle += diff * Math.min(1, delta * turnSpeed)
}

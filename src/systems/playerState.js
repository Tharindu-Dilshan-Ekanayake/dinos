import * as THREE from 'three'
import { PLAYER_SPAWN } from '../data/lobby.js'

/**
 * The lobby player's live position, shared between the controller that writes
 * it and everything that reacts to it (podium highlights, the arena gate, the
 * follow camera).
 *
 * A plain module-level vector rather than context or store state: it changes
 * every frame while walking, and nothing that reads it should re-render.
 */
export const playerPosition = new THREE.Vector3(...PLAYER_SPAWN)

/**
 * Facing angle in radians. The dino model faces +X, so PI/2 turns it to face
 * -Z - down the plaza, away from the camera.
 */
export const playerFacing = { angle: Math.PI / 2 }

/**
 * Vertical motion, owned by the shared player controller.
 * `grounded` gates jumping so you cannot climb the sky by mashing Space.
 */
export const playerMotion = { velocityY: 0, grounded: true }

/** Reset to the hub entrance, e.g. when returning from the arena. */
export function resetPlayerPosition() {
  playerPosition.set(...PLAYER_SPAWN)
  playerFacing.angle = Math.PI / 2
  playerMotion.velocityY = 0
  playerMotion.grounded = true
}

/** Drop the player at an arbitrary spawn, used when entering the arena. */
export function placePlayer(position, angle = Math.PI / 2) {
  playerPosition.set(position[0], position[1] ?? 0, position[2])
  playerFacing.angle = angle
  playerMotion.velocityY = 0
  playerMotion.grounded = true
}

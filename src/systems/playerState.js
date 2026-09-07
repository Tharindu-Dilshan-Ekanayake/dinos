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

/**
 * What the dino is busy doing, where that is not simply walking.
 *
 * `training` is set by the hub's pad scan and read by the controller in the
 * same frame, which is the whole reason it lives out here rather than in the
 * store: standing on a treadmill has to move the legs, and a flag that costs a
 * re-render cannot be read sixty times a second.
 */
export const playerActivity = { training: false }

/**
 * Whether the dino was *put* somewhere rather than walking there.
 *
 * The follow camera eases toward wherever the dino is, which is what makes a
 * swing glide instead of snapping. Across a teleport that same easing becomes a
 * six-hundred-unit fly-through of the corridor - and entering Stage 1 looked
 * like the game was playing a cutscene at you. A camera cannot tell a long walk
 * from a jump cut by watching the position, so the jump says so itself.
 */
let teleported = true

/** Reads and clears the teleport flag. Camera-only. */
export function consumeTeleport() {
  const value = teleported
  teleported = false
  return value
}

/** Reset to the hub entrance, e.g. when returning from the arena. */
export function resetPlayerPosition() {
  placePlayer(PLAYER_SPAWN)
}

/** Drop the player at an arbitrary spawn, optionally without a camera cut. */
export function placePlayer(position, angle = Math.PI / 2, { markTeleport = true } = {}) {
  playerPosition.set(position[0], position[1] ?? 0, position[2])
  playerFacing.angle = angle
  playerMotion.velocityY = 0
  playerMotion.grounded = true
  teleported = markTeleport
}

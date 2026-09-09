import * as THREE from 'three'
import { HUB_SPAWN, LOBBY_Z_OFFSET } from '../data/arena.js'

/**
 * The player's live position, in world coordinates, shared between the
 * controller that writes it and everything that reacts to it (podium
 * highlights, the arena gate, the follow camera, the enemy packs).
 *
 * A plain module-level vector rather than context or store state: it changes
 * every frame while walking, and nothing that reads it should re-render.
 *
 * World, everywhere, always. It used to be scene-local - hub numbers in the
 * hub, arena numbers in the arena, the two the same axes slid sixty-three
 * apart - and the crossing between them was a conversion, which meant one dino
 * had to be swapped for another at the gateway and every seam bug this game
 * has had came out of that swap. The hub is still *drawn* in its own numbers,
 * inside a group at that offset; anything in there that needs the player in
 * its own terms asks `playerHub` below.
 */
export const playerPosition = new THREE.Vector3(...HUB_SPAWN)

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

/**
 * The player, in the hub's own coordinates.
 *
 * Everything mounted inside the hub's offset group - podiums, training pads,
 * the gateway, its sky - measures against layout written in hub numbers, and
 * should go on doing exactly that rather than having its own data rewritten to
 * suit the arena. This is the one place the two are reconciled.
 *
 * Shared scratch: read it within the frame, never hold onto it.
 */
const hubLocal = new THREE.Vector3()

export function playerHub() {
  return hubLocal.set(
    playerPosition.x,
    playerPosition.y,
    playerPosition.z - LOBBY_Z_OFFSET
  )
}

/** Drop the player at an arbitrary spawn, optionally without a camera cut. */
export function placePlayer(position, angle = Math.PI / 2, { markTeleport = true } = {}) {
  playerPosition.set(position[0], position[1] ?? 0, position[2])
  playerFacing.angle = angle
  playerMotion.velocityY = 0
  playerMotion.grounded = true
  teleported = markTeleport
}

import * as THREE from 'three'
import { LOBBY_Z_OFFSET } from '../data/arena.js'
import { useGameStore } from '../store/useGameStore.js'
import { playerPosition } from './playerState.js'

/**
 * Where the player is in *world* space, whichever half of the game they are in.
 *
 * `playerPosition` is scene-local: it holds hub coordinates while you are in
 * the hub and arena coordinates once you are in the arena, and the two are the
 * same axes slid `LOBBY_Z_OFFSET` apart. Anything living inside the hub's own
 * offset group - podiums, training pads, the gate trigger - wants exactly that,
 * and must go on reading `playerPosition` directly.
 *
 * What it is wrong for is everything drawn in world space that *follows* the
 * player: the sun and its shadow camera, the skydome, the bedrock plane under
 * the horizon, the weather field, the birds. Those are mounted in the arena's
 * (unshifted) environment and run in both halves of the game, so in the hub
 * they were all centred sixty-three units behind where the player actually
 * appears - and on the frame you crossed into Stage 1, `playerPosition` changed
 * which coordinate system it was speaking and every one of them jumped that
 * distance at once.
 *
 * That jump is the whole of the "it teleported" feeling. Nothing about the
 * geometry changes at the gateway - both halves are drawn continuously, side by
 * side, every frame - but the sun swings, the sky slides, the horizon shifts
 * and the flock you were watching is suddenly somewhere else. Reading the
 * player's world position instead, none of them move at all: the number they
 * follow is the same before and after, because it describes the same place.
 */

/**
 * Shared scratch. Callers read `.x`/`.z` off it within the same frame - the
 * same pattern the flocking and weather loops already use for their own
 * matrices - so it is never held onto.
 */
const world = new THREE.Vector3()

/** The offset from scene-local coordinates to world ones, right now. */
export function playerWorldOffsetZ() {
  return useGameStore.getState().scene === 'lobby' ? LOBBY_Z_OFFSET : 0
}

/**
 * The player's world position. Read it immediately; do not keep the vector.
 *
 * X needs no correction - the hub is only ever slid along Z - but it is
 * returned as a whole position anyway so a caller never has to remember which
 * axis was the special one.
 */
export function playerWorld() {
  return world.set(playerPosition.x, playerPosition.y, playerPosition.z + playerWorldOffsetZ())
}

import * as THREE from 'three'
import { MAX_ENEMIES } from '../data/arena.js'
import { stageHealth } from '../data/stages.js'

/**
 * Live positions and targeting for the enemy pack.
 *
 * Enemies move every frame and the combat code needs their positions every
 * frame, so this is a plain module rather than store state - nothing that
 * reads it should re-render.
 *
 * Health is deliberately *not* duplicated here. The store still owns a single
 * pool per stage; the pack simply divides that pool into bands, which keeps
 * rewards, gating, saves and the existing damage pipeline untouched.
 */

/** World position of each pack slot, written by the enemies themselves. */
export const enemySlots = Array.from({ length: MAX_ENEMIES }, () => new THREE.Vector3())

export const packState = {
  /** Slot currently taking damage, or -1 when the stage is clear. */
  targetSlot: -1,
  /** How many of the pack are still standing. */
  aliveCount: 0,
  /** Total slots this stage actually uses (1 for a boss). */
  slotCount: MAX_ENEMIES,
  /** Whether the player is close enough to hit the target. */
  inRange: false,
  /** Distance from the player to the current target. */
  targetDistance: Infinity,
}

/**
 * How many enemies remain at a given health ratio.
 *
 * The pool drains from full to empty, and the pack thins as it goes: with five
 * enemies, the fifth falls at 80% health, the fourth at 60%, and so on.
 */
export function aliveCountFor(ratio, slotCount) {
  if (ratio <= 0) return 0
  return Math.min(slotCount, Math.ceil(ratio * slotCount))
}

/**
 * A single enemy's own 0-1 health, derived from the shared pool.
 *
 * Slot `i` owns the band [i/n, (i+1)/n]: below it the enemy is dead, above it
 * untouched, and inside it the enemy is the one currently being chewed on.
 */
export function slotHealthRatio(ratio, slot, slotCount) {
  const band = 1 / slotCount
  const low = slot * band
  if (ratio <= low) return 0
  if (ratio >= low + band) return 1
  return (ratio - low) / band
}

/**
 * How much of a chamber's pack is still standing, as 0-1.
 *
 * Every chamber in the corridor keeps its own pack standing in it, so a pack
 * has to be able to answer this about itself rather than assuming it is the
 * one being fought. The level you are actually in reads the live pool; every
 * other one reads what it was left at, and a level never entered is untouched.
 */
export function chamberRatio(store, stage) {
  const max = stageHealth(stage)
  if (max <= 0) return 0
  const raw =
    stage === store.stageIndex ? store.enemyHealth : store.chamberHealth?.[stage] ?? max
  return Math.max(0, Math.min(1, raw / max))
}

/**
 * Where the last blow landed.
 *
 * The particle and debris systems used to spawn at a fixed point, which was
 * fine when the enemy was a stationary blob. Now that enemies walk, effects
 * follow this instead so bursts happen where the fight actually is.
 */
export const lastImpact = new THREE.Vector3(0, 1.2, -6)

/** Record an impact position for the effect layers. */
export function setLastImpact(x, y, z) {
  lastImpact.set(x, y, z)
}

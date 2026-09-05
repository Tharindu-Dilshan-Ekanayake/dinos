import { requiredDamage } from './stages.js'

/**
 * Core player progression balance: damage, rebirth and click growth.
 *
 * Damage is the headline stat and it is *accumulated*: every click adds the
 * equipped dino's own damage to it, so a stronger dino is a faster earner
 * rather than a flat multiplier. That is what makes picking a dino at a podium
 * a decision instead of a formality.
 */

/** Click damage before any multipliers. */
export const BASE_STRENGTH = 1

/**
 * Damage earned for clearing a level.
 *
 * A slice of the level's own gate, so the reward keeps pace with the wall
 * ahead of it: clearing is a real shortcut toward the next door, but clicking
 * is still what gets you most of the way there.
 */
export function damageForClear(stageIndex) {
  return Math.max(2, requiredDamage(stageIndex) * 0.2)
}

/** Wins required before the Rebirth button unlocks. */
export const REBIRTH_WINS_REQUIRED = 500

/** Permanent power gained per rebirth (0.5 = +50% each). */
export const REBIRTH_MULTIPLIER_PER = 0.5

/** Rebirth multiplier at a given rebirth count. */
export function rebirthMultiplier(rebirths) {
  return 1 + rebirths * REBIRTH_MULTIPLIER_PER
}

/**
 * Final per-click damage.
 *
 * The evolution tier deliberately does *not* multiply this. A dino's power is
 * how much damage every click *adds* to your total, so folding it in here as
 * well would count it twice and turn a linear climb into a runaway one.
 */
export function computeClickPower(strength, rebirths) {
  return strength * rebirthMultiplier(rebirths)
}

/** Compact number formatting for the HUD: 1.2K, 3.4M, ... */
export function formatNumber(value) {
  const n = Math.floor(value)
  if (n < 1000) return String(n)
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp']
  let scaled = n
  let unit = -1
  while (scaled >= 1000 && unit < units.length - 1) {
    scaled /= 1000
    unit++
  }
  const rounded = scaled < 10 ? scaled.toFixed(2) : scaled < 100 ? scaled.toFixed(1) : Math.floor(scaled)
  return `${String(rounded).replace(/\.?0+$/, '')}${units[unit]}`
}

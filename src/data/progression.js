/**
 * Core player progression balance: strength, rebirth and click damage.
 */

/** Click damage before any multipliers. */
export const BASE_STRENGTH = 1

/**
 * Permanent strength earned for every blow you land.
 *
 * Small on purpose: this is the drip that rewards playing rather than a
 * replacement for training. Twelve or so clicks clear a level, so a level's
 * worth of swinging is about a quarter of a point of strength.
 */
export const STRENGTH_PER_HIT = 0.02

/**
 * Permanent strength earned for clearing a level.
 *
 * Scaled by how deep the level is, so the climb itself keeps pace with the
 * entry requirements ahead of it - fighting your way forward is a real way to
 * get stronger, not just a way to spend the strength you already had.
 */
export function strengthForClear(stageIndex) {
  return 0.5 + stageIndex * 0.35
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
 * strength (upgrades) x evolution tier power x rebirth multiplier.
 */
export function computeClickPower(strength, evolutionPower, rebirths) {
  return strength * evolutionPower * rebirthMultiplier(rebirths)
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

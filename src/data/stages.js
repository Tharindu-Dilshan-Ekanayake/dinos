/**
 * Stage / enemy balance.
 * Every tunable number for enemy scaling and rewards lives in this file.
 */

/** Health of stage 1. */
export const BASE_HEALTH = 12

/** Multiplicative health growth per stage. */
export const GROWTH_RATE = 1.15

/** Every Nth stage is a boss. */
export const BOSS_EVERY = 5

/** Boss health multiplier on top of the normal curve. */
export const BOSS_HEALTH_MULTIPLIER = 4.5

/** Wins granted for clearing a normal stage. */
export const BASE_WIN_REWARD = 1

/** Extra wins per stage cleared (linear drip so late stages stay worth it). */
export const WIN_REWARD_PER_STAGE = 0.34

/** Bosses pay this much more than a normal stage. */
export const BOSS_WIN_MULTIPLIER = 6

/** Total number of stages before the loop caps out. */
export const MAX_STAGES = 75

/** Damage multiplier applied to a click that lands as a critical hit. */
export const CRIT_MULTIPLIER = 3

/** Chance (0-1) for any given click to crit. */
export const CRIT_CHANCE = 0.12

/** True when the (0-indexed) stage is a boss stage. */
export function isBoss(stageIndex) {
  return (stageIndex + 1) % BOSS_EVERY === 0
}

/** Max health for a given 0-indexed stage. */
export function stageHealth(stageIndex) {
  const base = BASE_HEALTH * Math.pow(GROWTH_RATE, stageIndex)
  const scaled = isBoss(stageIndex) ? base * BOSS_HEALTH_MULTIPLIER : base
  return Math.max(1, Math.round(scaled))
}

/** Wins awarded for clearing a given 0-indexed stage. */
export function stageReward(stageIndex) {
  const base = BASE_WIN_REWARD + stageIndex * WIN_REWARD_PER_STAGE
  const scaled = isBoss(stageIndex) ? base * BOSS_WIN_MULTIPLIER : base
  return Math.max(1, Math.round(scaled))
}

/** Display name for a stage, e.g. "Stage 12". */
export function stageLabel(stageIndex) {
  return `Stage ${stageIndex + 1}`
}

/* --------------------------------------------------- level gating / damage */

/**
 * Clicks a correctly-geared player should need to clear a stage. The
 * "Recommended Damage" the arena shows is simply the stage's health divided by
 * this, so the advice can never drift away from the actual health curve.
 */
export const TARGET_CLICKS_TO_CLEAR = 12

/**
 * A stage refuses to open below this fraction of its recommended damage.
 *
 * Without a floor a player can technically enter any unlocked stage and then
 * spend an hour chipping at it, which reads as a broken game rather than a
 * hard one. The floor pushes them back to training instead.
 *
 * Set high enough that walking into the next level is something you earn: at
 * a quarter you could scrape into almost anything you had unlocked, which made
 * the climb a formality. Stage 1 is unaffected - its requirement rounds to 1
 * either way, so a new player is never locked out of the game's front door.
 */
export const MIN_DAMAGE_FRACTION = 0.45

/** Damage per click this stage is tuned for. */
export function recommendedDamage(stageIndex) {
  return Math.max(1, Math.ceil(stageHealth(stageIndex) / TARGET_CLICKS_TO_CLEAR))
}

/** Minimum click damage required to enter a stage at all. */
export function requiredDamage(stageIndex) {
  return Math.max(1, Math.ceil(recommendedDamage(stageIndex) * MIN_DAMAGE_FRACTION))
}

/**
 * How this stage will feel at a given click power.
 * Drives the colour of the stage headline and the level list.
 */
export function damageRating(clickPower, stageIndex) {
  const ratio = clickPower / recommendedDamage(stageIndex)
  if (ratio >= 1.5) return 'easy'
  if (ratio >= 0.75) return 'fair'
  if (ratio >= MIN_DAMAGE_FRACTION) return 'risky'
  return 'blocked'
}

/**
 * Stages open in order: clearing one unlocks the next. `bestStage` is the
 * furthest stage the player has ever reached, so progress survives replaying
 * an earlier level to farm it.
 */
export function highestUnlockedStage(bestStage) {
  return Math.min(MAX_STAGES - 1, Math.max(0, bestStage))
}

/** Both gates a stage has to pass before the player can drop into it. */
export function canEnterStage(stageIndex, { bestStage, clickPower }) {
  if (stageIndex < 0 || stageIndex >= MAX_STAGES) {
    return { allowed: false, reason: 'range' }
  }
  if (stageIndex > highestUnlockedStage(bestStage)) {
    return { allowed: false, reason: 'locked' }
  }
  if (clickPower < requiredDamage(stageIndex)) {
    return { allowed: false, reason: 'damage', required: requiredDamage(stageIndex) }
  }
  return { allowed: true, reason: null }
}

/**
 * Stage / enemy balance.
 * Every tunable number for enemy scaling and rewards lives in this file.
 */

/** Health of stage 1. */
export const BASE_HEALTH = 12

/** Every Nth stage is a boss. */
export const BOSS_EVERY = 5

/**
 * Boss health multiplier on top of the normal curve.
 *
 * Modest, because the curve it multiplies is already the entry gate times
 * TARGET_CLICKS_TO_CLEAR. At 4.5 a boss was a fifty-four click fight - nearly
 * half a minute of standing still in front of something that bites.
 */
export const BOSS_HEALTH_MULTIPLIER = 2.2

/**
 * Wins granted for clearing a normal stage.
 *
 * Generous on purpose: Wins are what open the next dino, and a dino is what
 * makes the next damage gate reachable. Paying out in ones made the roster
 * feel a very long way off from inside a fight.
 */
export const BASE_WIN_REWARD = 3

/** Extra wins per stage cleared (linear drip so late stages stay worth it). */
export const WIN_REWARD_PER_STAGE = 1.2

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

/**
 * Max health for a given 0-indexed stage.
 *
 * Derived from the level's entry requirement rather than its own curve: a
 * level holds exactly as much health as TARGET_CLICKS_TO_CLEAR hits from a
 * dino that just barely met the gate. That keeps the two numbers from ever
 * drifting apart - a level you are allowed into is always a level you can
 * actually chew through.
 */
export function stageHealth(stageIndex) {
  const gate = requiredDamage(stageIndex)
  const base = gate > 0 ? gate * TARGET_CLICKS_TO_CLEAR : BASE_HEALTH
  const scaled = isBoss(stageIndex) ? base * BOSS_HEALTH_MULTIPLIER : base
  return Math.max(BASE_HEALTH, Math.round(scaled))
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
 * Damage each level's gate demands, in order.
 *
 * The first few are set by hand - 40 to step into Stage 2, 375 for Stage 3,
 * 1.5K for Stage 4 - because those early walls are what teach a player that
 * the gate is the real opponent. Stage 1 is free: the game's front door never
 * closes.
 *
 * Past the hand-set levels the requirement is multiplied on, with the
 * multiplier easing down as you climb. Early jumps are savage (roughly x9 then
 * x4) and later ones settle near x1.8, which keeps a seventy-five level ladder
 * from running off the end of arithmetic.
 */
const ENTRY_ANCHORS = [0, 40, 375, 1500]
const ENTRY_GROWTH_FLOOR = 1.75
const ENTRY_GROWTH_EXTRA = 1.45
const ENTRY_GROWTH_DECAY = 0.9

const ENTRY_TABLE = (() => {
  const out = [...ENTRY_ANCHORS]
  for (let i = ENTRY_ANCHORS.length; i < MAX_STAGES; i++) {
    const growth =
      ENTRY_GROWTH_FLOOR +
      ENTRY_GROWTH_EXTRA * Math.pow(ENTRY_GROWTH_DECAY, i - ENTRY_ANCHORS.length)
    out.push(Math.round(out[i - 1] * growth))
  }
  return out
})()

/** Minimum click damage required to enter a stage at all. */
export function requiredDamage(stageIndex) {
  if (stageIndex <= 0) return 0
  return ENTRY_TABLE[Math.min(stageIndex, ENTRY_TABLE.length - 1)]
}

/**
 * Damage per click this stage is tuned for.
 *
 * The same as its gate for a normal level; a boss holds several levels' worth
 * of health, so it wants proportionally more behind each hit.
 */
export function recommendedDamage(stageIndex) {
  return Math.max(1, Math.ceil(stageHealth(stageIndex) / TARGET_CLICKS_TO_CLEAR))
}

/**
 * How this stage will feel at a given click power.
 *
 * Measured against the *gate*, not against the stage's health.
 *
 * This used to divide by `recommendedDamage`, which is health-derived - and
 * since a boss holds several levels' worth of health, a player who had exactly
 * met the gate came out at a ratio near 0.2 and was rated 'risky' on a level
 * they were correctly equipped for. The pack then bit them at the risky rate
 * and killed them. Meeting the gate is the normal way to arrive at a level, so
 * meeting the gate has to rate as fair.
 */
export function damageRating(clickPower, stageIndex) {
  const gate = requiredDamage(stageIndex)
  // Stage 1 has no gate at all; anything with a pulse is fair there.
  if (gate <= 0) return clickPower >= recommendedDamage(stageIndex) ? 'fair' : 'risky'

  const ratio = clickPower / gate
  if (ratio >= 2.5) return 'easy'
  if (ratio >= 1) return 'fair'
  if (ratio >= 0.5) return 'risky'
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

import { damageRating, isBoss } from './stages.js'

/**
 * The fight going the other way: what the pack does to you.
 *
 * The arena used to be a one-sided punching bag - enemies walked at you and
 * waited to be clicked apart. Now they bite back, so standing in the middle of
 * a pack you are underpowered for actually kills you, and retreating out of
 * reach is a real move.
 *
 * Health is a flat pool read as a percentage rather than a number that has to
 * chase the exponential health curve. What scales instead is the *bite*: the
 * same pack hurts far more on a level your damage is not ready for, which is
 * what turns "this stage is risky" from a label into something you feel.
 */

/** The player's health pool. Flat, so the bar always reads as a percentage. */
export const MAX_PLAYER_HEALTH = 100

/**
 * How hard one bite lands, by how the stage rates against your click damage.
 *
 * Per *enemy*, and the whole pack comes at you now - so five of them at the
 * fair rate is what a single one used to do. These numbers were set back when
 * only the one dino you were fighting closed in; left alone, the pack change
 * turned every level in the game into a three-second death.
 *
 * Tuned so that clearing a level at exactly its gate costs roughly half your
 * health, and a pack you are badly under-geared for still kills you quickly.
 */
const BITE_BY_RATING = {
  easy: 1.5,
  fair: 2.5,
  risky: 6,
  blocked: 10,
}

/** A boss comes alone, so it has to hit for what a whole pack would. */
const BOSS_BITE_MULTIPLIER = 1.7

/** Damage one enemy bite does to the player. */
export function enemyBite(clickPower, stageIndex) {
  const base = BITE_BY_RATING[damageRating(clickPower, stageIndex)] ?? BITE_BY_RATING.fair
  return isBoss(stageIndex) ? base * BOSS_BITE_MULTIPLIER : base
}

/**
 * Seconds between one enemy's bites.
 *
 * Long enough that the first one is a warning rather than a surprise, and that
 * backing out of range is always an option.
 */
export const ENEMY_ATTACK_INTERVAL = 1.15

/** How close an enemy has to be to land a bite. */
export const ENEMY_ATTACK_RANGE = 3.4

/** Health regained per second once nothing has touched you for a moment. */
export const HEALTH_REGEN_PER_SECOND = 5

/** Quiet seconds before that regeneration starts. */
export const REGEN_DELAY = 3.5

/** Health handed back for clearing a level. */
export const CLEAR_HEAL = 25

/** How often health changes are committed to the store, in seconds. */
export const HEALTH_FLUSH_INTERVAL = 0.2

/**
 * Wins-purchased upgrades. Costs grow geometrically; every number that
 * affects the economy is defined here.
 */

export const UPGRADES = {
  strength: {
    id: 'strength',
    name: 'Bite Force',
    blurb: '+1 base click damage per level.',
    icon: '🦷',
    baseCost: 10,
    costGrowth: 1.18,
    /** Flat strength added per level. */
    perLevel: 1,
    maxLevel: 500,
  },
  idle: {
    id: 'idle',
    name: 'Primal Instinct',
    blurb: 'Auto-attacks while you rest.',
    icon: '🌀',
    baseCost: 60,
    costGrowth: 1.26,
    /**
     * Each level adds this fraction of your click power, dealt per second.
     * Level 1 = 8% DPS, level 10 = 80% DPS.
     */
    perLevel: 0.08,
    maxLevel: 100,
  },
  crit: {
    id: 'crit',
    name: 'Savage Jaws',
    blurb: '+1.5% critical hit chance per level.',
    icon: '💥',
    baseCost: 120,
    costGrowth: 1.32,
    perLevel: 0.015,
    maxLevel: 40,
  },
}

export const UPGRADE_LIST = [UPGRADES.strength, UPGRADES.idle, UPGRADES.crit]

/** Cost of the next level of an upgrade. */
export function upgradeCost(upgradeId, currentLevel) {
  const u = UPGRADES[upgradeId]
  if (!u) return Infinity
  return Math.ceil(u.baseCost * Math.pow(u.costGrowth, currentLevel))
}

/** Total flat strength granted by the strength upgrade. */
export function strengthFromLevels(level) {
  return level * UPGRADES.strength.perLevel
}

/** Fraction-of-click-power dealt per second by the idle upgrade. */
export function idleDpsFraction(level) {
  return level * UPGRADES.idle.perLevel
}

/** Bonus crit chance from the crit upgrade. */
export function critBonus(level) {
  return level * UPGRADES.crit.perLevel
}

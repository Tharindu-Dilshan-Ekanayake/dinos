/**
 * Enemy dinos.
 *
 * Enemies are built from the same rig as the player, so the arena reads as
 * dinos fighting dinos rather than a dino punching a prop. Each pack member
 * gets an archetype (a body shape) and a colour derived from the biome, so
 * every area fields visibly different opponents without any new assets.
 */

/**
 * Body shapes, in the flag vocabulary DinoModel already understands.
 * Kept deliberately varied so a pack of five never looks like a row of clones.
 */
export const ENEMY_ARCHETYPES = [
  { id: 'runner', plates: 2, frill: false, horns: 0, tailSpikes: false, crest: false, legs: 2, scale: 0.62, attack: 'bite' },
  { id: 'charger', plates: 4, frill: false, horns: 2, tailSpikes: false, crest: false, legs: 4, scale: 0.7, attack: 'charge' },
  { id: 'spiked', plates: 6, frill: false, horns: 1, tailSpikes: true, crest: false, legs: 4, scale: 0.66, attack: 'tail' },
  { id: 'sailback', plates: 4, frill: false, horns: 1, tailSpikes: false, crest: true, legs: 2, scale: 0.72, attack: 'fire' },
  { id: 'shielded', plates: 3, frill: true, horns: 3, tailSpikes: false, crest: false, legs: 4, scale: 0.68, attack: 'slam' },
]

/** Bosses are one big, maxed-out silhouette - and they breathe fire. */
export const BOSS_ARCHETYPE = {
  id: 'boss',
  plates: 8,
  frill: true,
  horns: 3,
  tailSpikes: true,
  crest: true,
  legs: 2,
  scale: 1.25,
  attack: 'fire',
}

/**
 * How each shape actually fights.
 *
 * A pack used to be five silhouettes all leaning in at the same range on the
 * same cooldown for the same damage, which made the variety in their bodies a
 * lie - they were one enemy wearing five hats. These are the numbers that make
 * a sailback something you back away from and a runner something you cannot.
 *
 * `reach`, `interval` and `power` multiply the shared values in data/combat.js
 * rather than replacing them, so the whole fight still scales off one set of
 * tuning knobs. `tell` is what the attack looks like; `sound` is what it is.
 */
export const ATTACK_STYLES = {
  /** Quick and close. Hurts least, lands most often. */
  bite: { reach: 0.9, interval: 0.7, power: 0.7, tell: 'lunge', sound: 'snap', color: '#ffd166' },
  /** Comes at you from further out and hits hard, but takes a while to wind up. */
  charge: { reach: 1.4, interval: 1.45, power: 1.8, tell: 'lunge', sound: 'heavy', color: '#ff9f43' },
  /** A tail swept round it - wide, and the only one that reads sideways. */
  tail: { reach: 1.2, interval: 1, power: 1.05, tell: 'sweep', sound: 'snap', color: '#a3e635' },
  /** Breathes fire. Outranges everything, so closing on one is a decision. */
  fire: { reach: 2.2, interval: 1.55, power: 1.3, tell: 'breath', sound: 'fire', color: '#ff6b3d' },
  /** Drops its whole weight on you. Slow, short, and the hardest single hit. */
  slam: { reach: 0.85, interval: 1.3, power: 1.5, tell: 'stomp', sound: 'heavy', color: '#c084fc' },
}

/** How the enemy in a given pack slot fights. */
export function enemyAttackStyle(slot, boss) {
  const archetype = boss ? BOSS_ARCHETYPE : ENEMY_ARCHETYPES[slot % ENEMY_ARCHETYPES.length]
  return ATTACK_STYLES[archetype.attack] ?? ATTACK_STYLES.bite
}

/** Deterministic per-slot hue jitter, so a pack varies but never flickers. */
function slotShift(stageIndex, slot) {
  const n = Math.sin(stageIndex * 12.9898 + slot * 78.233) * 43758.5453
  return n - Math.floor(n)
}

/**
 * An evolution-shaped descriptor DinoModel and useDinoMaterials can consume.
 *
 * Enemies borrow the biome's `enemy` / `enemyAccent` colours so they always
 * contrast with the ground they stand on, and late stages pick up a faint glow
 * to sell them as tougher.
 */
export function enemyAppearance(area, stageIndex, slot, boss) {
  const archetype = boss ? BOSS_ARCHETYPE : ENEMY_ARCHETYPES[slot % ENEMY_ARCHETYPES.length]
  const shift = slotShift(stageIndex, slot)

  return {
    id: `${area.id}-${archetype.id}-${slot}`,
    ...archetype,
    body: area.enemy,
    belly: area.enemyAccent,
    spike: boss ? '#ffd166' : area.enemyAccent,
    aura: area.enemyAccent,
    // A boss glows; regular enemies pick up a little shine in late biomes.
    glow: boss ? 0.6 : 0,
    // Slight per-slot size variation keeps the line-up from looking stamped.
    scale: archetype.scale * (0.92 + shift * 0.18),
  }
}

import { shadeColor } from './areas.js'

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
  { id: 'runner', build: 'raptor', plates: 2, frill: false, horns: 0, tailSpikes: false, crest: false, legs: 2, scale: 0.62, attack: 'bite', pattern: 'stripes' },
  { id: 'charger', build: 'trike', plates: 4, frill: false, horns: 2, tailSpikes: false, crest: false, legs: 4, scale: 0.7, attack: 'charge', pattern: 'ridge' },
  { id: 'spiked', build: 'stego', plates: 6, frill: false, horns: 1, tailSpikes: true, crest: false, legs: 4, scale: 0.66, attack: 'tail', pattern: 'plated' },
  { id: 'sailback', build: 'sail', plates: 4, frill: false, horns: 1, tailSpikes: false, crest: true, legs: 2, scale: 0.72, attack: 'fire', pattern: 'spots' },
  { id: 'shielded', build: 'anky', plates: 3, frill: true, horns: 3, tailSpikes: false, crest: false, legs: 4, scale: 0.68, attack: 'slam', pattern: 'plated' },
  { id: 'raptor', build: 'raptor', plates: 1, frill: false, horns: 0, tailSpikes: true, crest: false, legs: 2, scale: 0.58, attack: 'claw', pattern: 'stripes' },
  { id: 'spitter', build: 'wyrm', plates: 3, frill: true, horns: 0, tailSpikes: false, crest: true, legs: 2, scale: 0.64, attack: 'spit', pattern: 'spots' },
]

/** Bosses are one big, maxed-out silhouette - and they breathe fire. */
export const BOSS_ARCHETYPE = {
  id: 'boss',
  build: 'colossus',
  plates: 8,
  frill: true,
  horns: 3,
  tailSpikes: true,
  crest: true,
  legs: 2,
  scale: 1.25,
  attack: 'fire',
  pattern: 'ridge',
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
  /** Claws, thrown in an arc. The fastest thing in the pack. */
  claw: { reach: 1, interval: 0.6, power: 0.8, tell: 'slash', sound: 'snap', color: '#67e8f9' },
  /** Spits from range. Weaker than fire, and it does not have to close. */
  spit: { reach: 1.8, interval: 1.1, power: 0.9, tell: 'spit', sound: 'fire', color: '#84cc16' },
}

/**
 * How long an enemy's attack animation runs, and how much of that is wind-up.
 *
 * The wind-up is the half of a blow that makes it readable: something rears,
 * and *then* it hits you. So the pack announces a swing this far ahead of
 * landing it (`ENEMY_WINDUP`) and the blow itself - damage, sound and the
 * effect out of its mouth - arrives on `ENEMY_ATTACK` at the end of it. Both
 * halves come off the same cooldown, so the pose and the hit can never drift.
 */
export const ATTACK_WINDUP_SECONDS = 0.16

/** Wind-up, strike and recovery together. */
export const ATTACK_ANIM_SECONDS = 0.48

/**
 * Which shape stands in a given slot of a given level's pack.
 *
 * It used to be `slot % archetypes`, which meant slot 0 was a runner in every
 * level of the game, slot 1 a charger in every level of the game, and so on -
 * so the twentieth pack you fought was the first pack in different colours.
 *
 * The line-up is rotated by the stage and then strided through it. The
 * archetype count is prime, so every stride from 1 upward walks the whole list
 * before repeating: within one pack no shape comes up twice, and the mix
 * itself changes from level to level.
 */
export function enemyArchetype(stageIndex, slot, boss) {
  if (boss) return BOSS_ARCHETYPE
  const n = ENEMY_ARCHETYPES.length
  const stage = Math.max(0, stageIndex | 0)
  const stride = 1 + (stage % (n - 1))
  return ENEMY_ARCHETYPES[(stage + slot * stride) % n]
}

/** How the enemy in a given pack slot fights. */
export function enemyAttackStyle(stageIndex, slot, boss) {
  return ATTACK_STYLES[enemyArchetype(stageIndex, slot, boss).attack] ?? ATTACK_STYLES.bite
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
  const archetype = enemyArchetype(stageIndex, slot, boss)
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
    /*
     * Markings in a deepened cut of the body rather than the accent - the
     * accent is already the belly and the spikes, so drawing stripes in it
     * would be drawing them in a colour the animal is half made of.
     */
    mark: boss ? '#ffd166' : shadeColor(area.enemy, -0.3),
  }
}

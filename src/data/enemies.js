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
  { id: 'runner', plates: 2, frill: false, horns: 0, tailSpikes: false, crest: false, legs: 2, scale: 0.62 },
  { id: 'charger', plates: 4, frill: false, horns: 2, tailSpikes: false, crest: false, legs: 4, scale: 0.7 },
  { id: 'spiked', plates: 6, frill: false, horns: 1, tailSpikes: true, crest: false, legs: 4, scale: 0.66 },
  { id: 'sailback', plates: 4, frill: false, horns: 1, tailSpikes: false, crest: true, legs: 2, scale: 0.72 },
  { id: 'shielded', plates: 3, frill: true, horns: 3, tailSpikes: false, crest: false, legs: 4, scale: 0.68 },
]

/** Bosses are one big, maxed-out silhouette. */
export const BOSS_ARCHETYPE = {
  id: 'boss',
  plates: 8,
  frill: true,
  horns: 3,
  tailSpikes: true,
  crest: true,
  legs: 2,
  scale: 1.25,
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

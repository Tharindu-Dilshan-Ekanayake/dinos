/**
 * Battle arena level geometry.
 *
 * The fight happens in a walled hollow: a checkered floor ringed by blocky
 * terraces that step up and away on three sides, with a deliberate gap in the
 * back wall so the biome behind it reads as a bright opening rather than a
 * dead end. The camera looks down -Z, so the gap sits directly behind the
 * fighters and gives the shot depth.
 *
 * Everything here is pure layout data, generated deterministically, so the
 * arena can be re-shaped without touching a component.
 */

export const ARENA = {
  /** Distance from the centre line to the inner face of the side walls. */
  halfWidth: 13,
  /** Inner face of the back wall. */
  backZ: -16,
  /** Where the side walls stop, behind the camera. */
  frontZ: 10,
  /** Half-width of the opening left in the back wall. */
  gapHalfWidth: 4.6,
  /** Size of one checker square on the floor. */
  tileSize: 2.6,
  /** Radius of the raised fighting pad ring. */
  padRadius: 6.1,
}

/**
 * Terrace steps. Each tier sits further out and higher than the last, which is
 * what gives the walls their layered, carved-out look.
 */
export const TIERS = [
  { inset: 0, height: 2.4, depth: 5 },
  { inset: 5, height: 5.2, depth: 5 },
  { inset: 10, height: 8.6, depth: 6 },
]

/** Deterministic LCG so the arena is identical on every load. */
function makeRandom(seed) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

/**
 * Every wall block in the arena.
 *
 * Returns plain boxes: `{ position, size, tier, top }`. `top` is the world Y of
 * the block's upper face, which the prop scatter uses to stand things on the
 * terraces without any raycasting.
 */
export function buildArenaBlocks() {
  const rand = makeRandom(90210)
  const blocks = []

  TIERS.forEach((tier, tierIndex) => {
    const offset = ARENA.halfWidth + tier.inset
    const centreOffset = offset + tier.depth / 2

    // --- Side walls, running the length of the arena ---
    const sideSpan = ARENA.frontZ - (ARENA.backZ - tier.inset)
    const sideCount = Math.max(1, Math.round(sideSpan / 6))
    const sideStep = sideSpan / sideCount

    for (let i = 0; i < sideCount; i++) {
      // Jitter the height a little so the wall reads as carved rock, not a fence.
      const height = tier.height * (0.86 + rand() * 0.32)
      const z = ARENA.backZ - tier.inset + sideStep * (i + 0.5)
      const depth = sideStep * 1.02

      for (const sign of [-1, 1]) {
        blocks.push({
          position: [sign * centreOffset, height / 2, z],
          size: [tier.depth, height, depth],
          tier: tierIndex,
          top: height,
        })
      }
    }

    // --- Back wall, split around the central opening ---
    const backZ = ARENA.backZ - tier.inset - tier.depth / 2
    const backSpan = offset + tier.depth
    const backCount = Math.max(1, Math.round((backSpan * 2) / 6))
    const backStep = (backSpan * 2) / backCount

    for (let i = 0; i < backCount; i++) {
      const x = -backSpan + backStep * (i + 0.5)
      // Leave the middle open so the biome shows through behind the fight.
      if (Math.abs(x) < ARENA.gapHalfWidth + backStep * 0.5) continue

      const height = tier.height * (0.86 + rand() * 0.32)
      blocks.push({
        position: [x, height / 2, backZ],
        size: [backStep * 1.02, height, tier.depth],
        tier: tierIndex,
        top: height,
      })
    }
  })

  return blocks
}

/**
 * Scatter of rim props standing on the terraces.
 *
 * Props are placed on top of real wall blocks, so nothing floats and nothing
 * intersects the arena floor.
 */
export function buildArenaProps(blocks, count = 44) {
  const rand = makeRandom(4242)
  const props = []

  // Only the outer two tiers get props - the innermost wall stays clean so it
  // never clutters the silhouette of the fighters.
  const candidates = blocks.filter((b) => b.tier > 0)
  if (candidates.length === 0) return props

  for (let i = 0; i < count; i++) {
    const block = candidates[Math.floor(rand() * candidates.length)]
    const [bx, , bz] = block.position
    const [sx, , sz] = block.size

    props.push({
      position: [
        bx + (rand() - 0.5) * sx * 0.7,
        block.top,
        bz + (rand() - 0.5) * sz * 0.7,
      ],
      scale: 0.75 + rand() * 0.95,
      rotation: rand() * Math.PI * 2,
    })
  }

  return props
}

/**
 * Glowing cracks across the floor, used by biomes with `glowStrength > 0`
 * (lava in the caldera, spore light in the marsh, rift energy in the cosmos).
 */
export function buildGlowVeins(count = 26) {
  const rand = makeRandom(777)
  const veins = []

  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2
    const radius = ARENA.padRadius + 1 + rand() * 11
    // Long and narrow: a crack in the ground, not a painted stripe.
    veins.push({
      position: [Math.cos(angle) * radius, 0.03, Math.sin(angle) * radius - 3],
      rotation: rand() * Math.PI,
      length: 3.5 + rand() * 8,
      width: 0.09 + rand() * 0.17,
    })
  }

  return veins
}

/* ------------------------------------------------------------- corridor */

/**
 * The arena is a corridor of chambers laid end to end along -Z.
 *
 * Chamber k sits at world Z `-k * CHAMBER_SPAN`, so walking forward carries
 * you out of one level, through the gap in its back wall, and into the next.
 * Nothing is ever teleported and no chamber is reused, which is what lets each
 * level carry its own palette and read as a different place.
 */
export const CHAMBER_SPAN = 40

/** World Z origin of a chamber. All chamber-local coordinates add this. */
export function chamberOrigin(stageIndex) {
  return -stageIndex * CHAMBER_SPAN
}

/** Half-width of the passage through the back wall between two chambers. */
export const PASSAGE_HALF_WIDTH = ARENA.gapHalfWidth - 0.8

/* ------------------------------------------------------- walkable playfield */

/** Where you land when you drop into the arena, near the front wall. */
export const ARENA_PLAYER_SPAWN = [0, 0, 5.2]

/** Keeps the player inside the hollow without needing collision meshes. */
export const ARENA_BOUNDS = {
  minX: -(ARENA.halfWidth - 1.5),
  maxX: ARENA.halfWidth - 1.5,
  minZ: ARENA.backZ + 2,
  maxZ: ARENA.frontZ - 2.5,
}

/**
 * How far past a chamber's own walls the player may stand.
 *
 * This is the passage between chambers. Bounds have to reach into it, or
 * crossing a boundary would snap the dino back inside the chamber it just
 * left - the exact jolt the corridor exists to avoid.
 */
export const PASSAGE_LENGTH =
  CHAMBER_SPAN - (ARENA_BOUNDS.maxZ - ARENA_BOUNDS.minZ)

export const ARENA_PLAYER_SPEED = 9
export const ARENA_PLAYER_TURN_SPEED = 10

/** The arena floor is flat; jumping still needs a surface to land on. */
export function arenaGroundHeight() {
  return 0
}

/* ------------------------------------------------------------ enemy packs */

/** Upper bound on pack size, used to size the shared slot arrays. */
export const MAX_ENEMIES = 7

/**
 * How many dinos a level throws at you at once.
 *
 * Bosses come alone; everything else cycles through a fixed pattern so the
 * rhythm of a run varies - a couple of light levels, then a crowd - without
 * any randomness that would make one player's stage 12 harder than another's.
 */
const PACK_PATTERN = [3, 4, 5, 4, 6, 5, 7, 4]

export function enemyCountForStage(stageIndex, boss) {
  if (boss) return 1
  return PACK_PATTERN[stageIndex % PACK_PATTERN.length]
}

/**
 * Where a pack of `count` stands, ordered far-to-near.
 *
 * Enemies die from the end of this list backwards, so the nearest ones fall
 * first and the fight naturally pushes you deeper into the chamber. Laid out
 * in two ranks so even a pack of seven stays readable.
 */
export function buildFormation(count) {
  if (count <= 1) return [[0, 0, -8]]

  const backRow = Math.ceil(count / 2)
  const frontRow = count - backRow
  const slots = []

  for (let i = 0; i < backRow; i++) {
    const t = backRow === 1 ? 0.5 : i / (backRow - 1)
    slots.push([-7.5 + t * 15, 0, -11.5])
  }
  for (let i = 0; i < frontRow; i++) {
    const t = frontRow === 1 ? 0.5 : i / (frontRow - 1)
    slots.push([-5 + t * 10, 0, -6.5])
  }
  return slots
}

/** How close you must be for an attack to land. */
export const ATTACK_RANGE = 5.5

/** How close a chasing enemy will get before it stops. */
export const ENEMY_STOP_DISTANCE = 3.2

/** Chase speed, kept below the player so you can always disengage. */
export const ENEMY_SPEED = 4.2

/** Formation for a given stage. */
export function enemyFormation(stageIndex, boss) {
  return buildFormation(enemyCountForStage(stageIndex, boss))
}

/* ----------------------------------------------------------------- gates */

/**
 * The two ends of a level chamber.
 *
 * You arrive at the entry gate and fight your way to the exit gate, which is
 * sealed until the chamber is clear. Walking into the open exit is what takes
 * you to the next level - and what runs the damage check.
 */
export const ENTRY_GATE = { position: [0, 0, ARENA.frontZ - 1.5], radius: 3 }
export const EXIT_GATE = { position: [0, 0, ARENA.backZ + 1.2], radius: 3.2 }

/** How close you must be to the exit for it to trigger. */
export const GATE_TRIGGER_RADIUS = 2.6

/**
 * Return pads flanking the exit.
 *
 * Stepping on one banks the Wins you are carrying and sends you back to the
 * hub. They only appear once the chamber is clear, which is what makes the
 * end of a level a decision - cash out, or push through the gate for more.
 */
export const RETURN_PADS = [
  { id: 'left', position: [-ARENA.gapHalfWidth - 2.6, 0, ARENA.backZ + 3.4] },
  { id: 'right', position: [ARENA.gapHalfWidth + 2.6, 0, ARENA.backZ + 3.4] },
]

export const RETURN_PAD_RADIUS = 1.5

/**
 * The near end of the chamber. Walking back into it retreats one level, and
 * from Stage 1 it walks you out of the arena entirely.
 */
export const ENTRY_TRIGGER = { z: ARENA_BOUNDS.maxZ, radius: 1.1 }

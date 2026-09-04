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
          face: 'side',
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
        face: 'back',
        top: height,
      })
    }
  })

  return blocks
}

/**
 * Half-width of the widest prop at scale 1 - a tree's lower canopy.
 *
 * Props are inset from their block's edges by this much, so a canopy always
 * has terrace underneath it. Placing by trunk alone put the trunk on the block
 * and left the canopy hanging over the drop, which reads as a floating tree
 * however well planted the trunk actually is.
 */
const PROP_HALF_WIDTH = 1.45

/**
 * Scatter of rim props standing on the terraces.
 *
 * Props are placed on top of real wall blocks, so nothing floats, nothing
 * overhangs a cliff edge, and nothing intersects the arena floor.
 */
export function buildArenaProps(blocks, seed = 0, count = 44) {
  const rand = makeRandom(4242 + seed * 3571)
  const props = []

  // Only the outer two tiers get props - the innermost wall stays clean so it
  // never clutters the silhouette of the fighters.
  const candidates = blocks.filter((b) => b.tier > 0)
  if (candidates.length === 0) return props

  for (let i = 0; i < count; i++) {
    const block = candidates[Math.floor(rand() * candidates.length)]
    const [bx, , bz] = block.position
    const [sx, , sz] = block.size

    const scale = 0.75 + rand() * 0.8
    const half = PROP_HALF_WIDTH * scale
    // Whatever room is left on the block once the canopy is accounted for.
    const roomX = Math.max(0, sx / 2 - half)
    const roomZ = Math.max(0, sz / 2 - half)

    props.push({
      position: [
        bx + (rand() - 0.5) * 2 * roomX,
        block.top,
        bz + (rand() - 0.5) * 2 * roomZ,
      ],
      scale,
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

/* --------------------------------------------------- voxel ground dressing */

/*
 * Every builder below takes the level's index as a seed. The walls are shared
 * layout - they decide where you can walk - but the dressing is not, and two
 * chambers wearing an identical scatter is obvious when you can see the next
 * one through the gate.
 */

/**
 * The floor is a single texture, which from above reads as wallpaper. These
 * are the blocky colour patches painted over it - the lighter and darker
 * clearings that make the ground look built out of blocks rather than printed.
 *
 * Boxes rather than decals: a 6cm lip catches the key light and gives the
 * patch an edge, which is exactly how the reference art reads.
 */
export function buildGroundPatches(seed = 0, count = 18) {
  const rand = makeRandom(5150 + seed * 7919)
  const patches = []

  const spanZ = ARENA.frontZ - ARENA.backZ

  for (let i = 0; i < count; i++) {
    const x = (rand() - 0.5) * 2 * (ARENA.halfWidth - 2)
    const z = ARENA.backZ + 1 + rand() * (spanZ - 2)

    // Keep the fighting pad clear: the ring around it has to stay readable.
    if (Math.hypot(x, z) < ARENA.padRadius + 1.2) continue

    patches.push({
      position: [x, 0.03, z],
      scale: [2.6 + rand() * 6, 0.06, 2.6 + rand() * 6],
      light: rand() < 0.5,
    })
  }

  return patches
}

/** True where a piece of ground dressing would sit on something in use. */
function blockedGround(x, z) {
  if (Math.hypot(x, z) < ARENA.padRadius + 0.5) return true
  // The exit gate and both return pads.
  if (z < ARENA.backZ + 5 && Math.abs(x) < ARENA.gapHalfWidth + 4.2) return true
  return false
}

/**
 * Grass blades and pebbles standing on the chamber floor.
 *
 * Blades come in clusters of two to four so the ground looks tufted rather
 * than evenly stubbled, but every blade is one instance of the same box - the
 * clustering costs nothing at draw time.
 */
export function buildGroundScatter(seed = 0, clusters = 46, pebbleCount = 18) {
  const rand = makeRandom(60613 + seed * 6151)
  const tufts = []
  const pebbles = []
  const flowers = []

  const spanZ = ARENA.frontZ - ARENA.backZ

  for (let i = 0; i < clusters; i++) {
    const cx = (rand() - 0.5) * 2 * (ARENA.halfWidth - 1)
    const cz = ARENA.backZ + 0.8 + rand() * (spanZ - 1)
    if (blockedGround(cx, cz)) continue

    const blades = 3 + Math.floor(rand() * 3)
    for (let b = 0; b < blades; b++) {
      const height = 0.4 + rand() * 0.4
      tufts.push({
        position: [cx + (rand() - 0.5) * 0.8, height / 2, cz + (rand() - 0.5) * 0.8],
        scale: [0.75 + rand() * 0.45, height, 0.75 + rand() * 0.45],
        rotation: rand() * Math.PI,
        // A slight lean stops a cluster looking like a row of fence posts.
        tilt: (rand() - 0.5) * 0.3,
      })
    }

    // Roughly one clump in three is flowering. They grow out of a tuft rather
    // than standing alone, which is what keeps them from reading as litter
    // dropped on the grass.
    if (rand() < 0.34) {
      flowers.push({
        position: [cx + (rand() - 0.5) * 0.7, 0, cz + (rand() - 0.5) * 0.7],
        scale: 0.85 + rand() * 0.5,
        rotation: rand() * Math.PI,
      })
    }
  }

  for (let i = 0; i < pebbleCount; i++) {
    const x = (rand() - 0.5) * 2 * (ARENA.halfWidth - 1)
    const z = ARENA.backZ + 0.8 + rand() * (spanZ - 1)
    if (blockedGround(x, z)) continue

    // Flat and low: a stone lying in the grass, not a crate dropped on it.
    const height = 0.11 + rand() * 0.13
    pebbles.push({
      position: [x, height / 2, z],
      scale: [0.3 + rand() * 0.36, height, 0.3 + rand() * 0.36],
      rotation: rand() * Math.PI,
    })
  }

  return { tufts, pebbles, flowers }
}

/**
 * Chunks breaking up the cliff faces.
 *
 * A terrace made of plain boxes reads as a wall; the reference art hangs
 * loose blocks off it and piles rubble at its foot, which is what turns the
 * same silhouette into carved rock. Positions are derived from the wall blocks
 * themselves, so a chunk can never float away from the face it belongs to.
 */
export function buildCliffDetails(blocks, seed = 0) {
  const rand = makeRandom(24680 + seed * 4093)
  const items = []

  for (const block of blocks) {
    const [bx, , bz] = block.position
    const [sx, , sz] = block.size

    // The direction pointing from this block back into the arena.
    const inward = block.face === 'side' ? [-Math.sign(bx) || 1, 0] : [0, 1]

    // Chunks embedded in the face, half sunk into the wall.
    if (rand() < 0.62) {
      const size = 0.9 + rand() * 1.4
      const along = (rand() - 0.5) * 0.62
      items.push({
        position: [
          bx + inward[0] * (sx / 2) + (inward[0] === 0 ? along * sx : 0),
          block.top * (0.2 + rand() * 0.5),
          bz + inward[1] * (sz / 2) + (inward[1] === 0 ? along * sz : 0),
        ],
        scale: [size, size * (0.7 + rand() * 0.6), size],
        rotation: (rand() - 0.5) * 0.5,
      })
    }

    // Rubble at the foot of the innermost terrace only - the outer tiers are
    // too far back for anyone to read the detail.
    if (block.tier === 0 && rand() < 0.5) {
      const height = 0.5 + rand() * 0.9
      const along = (rand() - 0.5) * 0.7
      items.push({
        position: [
          bx + inward[0] * (sx / 2 + 0.4 + rand() * 1.1) + (inward[0] === 0 ? along * sx : 0),
          height / 2,
          bz + inward[1] * (sz / 2 + 0.4 + rand() * 1.1) + (inward[1] === 0 ? along * sz : 0),
        ],
        scale: [height * (0.9 + rand() * 0.8), height, height * (0.9 + rand() * 0.8)],
        rotation: rand() * Math.PI,
      })
    }
  }

  return items
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

/**
 * Pushes a point into the corridor's open space.
 *
 * The camera needs this as much as the dino does. A chamber is a slot between
 * two cliffs, and the cliffs are single-sided boxes: a camera swung sideways
 * ends up *inside* one, sees straight through its back faces, and the wall
 * simply vanishes - leaving the trees standing on top of it hanging in the sky
 * over an empty green plain.
 *
 * Mutates and returns the vector.
 */
export function clampToCorridor(point, playerZ = null, margin = 1.4) {
  // Which chamber's stretch of corridor this point is in.
  const stage = Math.round(-point.z / CHAMBER_SPAN)
  const localZ = point.z - chamberOrigin(stage)

  // The hollow itself, not the player's inset bounds - the camera is allowed
  // right up to the wall, it just may not go inside it.
  const inChamber = localZ >= ARENA.backZ && localZ <= ARENA.frontZ
  // Inside a chamber you have the full hollow; between them, only the gap cut
  // through the back wall.
  const halfWidth = inChamber
    ? ARENA.halfWidth - margin
    : Math.max(0.5, PASSAGE_HALF_WIDTH - margin * 0.5)

  if (point.x > halfWidth) point.x = halfWidth
  else if (point.x < -halfWidth) point.x = -halfWidth

  /*
   * While the player is still inside the hollow, the camera stays on their
   * side of the back wall. Swinging it round to face the dino would otherwise
   * push it through the sealed gate, and the barrier is translucent from
   * behind - the whole screen washes out.
   */
  if (playerZ !== null) {
    const playerLocalZ = playerZ - chamberOrigin(Math.round(-playerZ / CHAMBER_SPAN))
    if (playerLocalZ >= ARENA.backZ && playerLocalZ <= ARENA.frontZ) {
      const back = chamberOrigin(Math.round(-playerZ / CHAMBER_SPAN)) + ARENA.backZ + 1.5
      if (point.z < back) point.z = back
    }
  }

  return point
}

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

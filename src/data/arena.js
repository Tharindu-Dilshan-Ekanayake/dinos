import { TREE_HALF_WIDTH } from './foliage.js'
/*
 * The hub's own layout, used to build the view back out of the arena's mouth.
 * Imported rather than copied so the two halves of the game can never disagree
 * about where the staircase between them is.
 */
import {
  ARENA_ENTRANCE,
  ARENA_STAIR_TOP_Z,
  LEFT_TIER,
  PLAZA,
  PODIUMS,
  TRAINING_POSITIONS,
} from './lobby.js'

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
    // Smaller blocks, more of them: a terrace should look assembled out of
    // pieces rather than extruded as one slab. They are instanced, so twice as
    // many costs nothing extra to draw.
    const sideCount = Math.max(1, Math.round(sideSpan / 3.2))
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
    const backCount = Math.max(1, Math.round((backSpan * 2) / 3.2))
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
 * How far past `frontZ` the mouth wall's outermost tier reaches.
 *
 * Also how much extra ground chamber zero needs under it, since the wall would
 * otherwise stand off the end of the chamber's own floor slab.
 */
export const MOUTH_DEPTH = TIERS[TIERS.length - 1].inset + TIERS[TIERS.length - 1].depth

/**
 * The mouth of the arena: a front wall for the very first chamber.
 *
 * Every other chamber has the previous one's back wall standing in front of
 * it - that is the wall you look back *through* into the level you came from,
 * and what makes the corridor read as a corridor at all. Chamber zero has no
 * chamber before it, so it had nothing: Stage 1 opened onto an endless flat
 * plain with no edge to the world anywhere in sight.
 *
 * Built as the back wall's mirror, so the way home and the way on read as the
 * same kind of doorway.
 */
export function buildArenaMouth() {
  const rand = makeRandom(31337)
  const blocks = []

  TIERS.forEach((tier, tierIndex) => {
    const offset = ARENA.halfWidth + tier.inset
    const z = ARENA.frontZ + tier.inset + tier.depth / 2
    const span = offset + tier.depth
    const count = Math.max(1, Math.round((span * 2) / 3.2))
    const step = (span * 2) / count

    for (let i = 0; i < count; i++) {
      const x = -span + step * (i + 0.5)
      // Open all the way through, exactly like the wall it mirrors: this is
      // the doorway you look back down at the stairs and the hub.
      if (Math.abs(x) < ARENA.gapHalfWidth + step * 0.5) continue

      const height = tier.height * (0.86 + rand() * 0.32)
      blocks.push({
        position: [x, height / 2, z],
        size: [step * 1.02, height, tier.depth],
        tier: tierIndex,
        face: 'front',
        top: height,
      })
    }
  })

  return blocks
}

/* ------------------------------------------------ the way back to the hub */

/**
 * Everything past the arena's mouth: the stairs down, and the hub at the
 * bottom of them.
 *
 * Stage 1's doorway looks back at where the run started. None of it is
 * walkable - you leave through the doorway itself, a few paces short of the
 * top step - but a corridor you can walk both ways has to show you both of its
 * ends, and a blank plain out there said the opposite: that the arena was all
 * there was, and that the way home led nowhere.
 *
 * It is built from the hub's *own* measurements rather than a sketch of them,
 * so the flight of steps you climb in the lobby is the same flight you look
 * down from up here, and the podiums are still where you left them.
 */

/** Ground outside the mouth begins at the far face of the mouth wall. */
export const APPROACH_EDGE_Z = ARENA.frontZ + MOUTH_DEPTH

/** Flat ground between the doorway and the top step. */
const LANDING_DEPTH = 4.5

/** How far the hub sits below the arena floor: the staircase's whole climb. */
export const APPROACH_DROP = ARENA_ENTRANCE.stepCount * ARENA_ENTRANCE.stepRise

/**
 * Hub Z to arena Z.
 *
 * Both scenes run along the same axes, so the hub only has to be slid down the
 * corridor until its staircase lands on the arena's landing. X needs no
 * mapping at all: the podiums you walk past on your left on the way in are on
 * your right looking back out, which is exactly what turning round does.
 */
export const LOBBY_Z_OFFSET = APPROACH_EDGE_Z + LANDING_DEPTH - ARENA_STAIR_TOP_Z

/** Hub Y to arena Y - the arena floor is the top of the stairs. */
function lobbyY(y) {
  return y - APPROACH_DROP
}

/** Hub Z to arena Z. */
function lobbyZ(z) {
  return z + LOBBY_Z_OFFSET
}

/**
 * How far out the view runs.
 *
 * Far enough to carry the whole plaza now that the fog reaches three chambers
 * rather than two - the hub is only ninety units off the mouth, so all of it
 * lands inside the haze rather than half of it being cut away.
 */
const APPROACH_FAR_Z = 170

/**
 * The whole view out of the mouth, grouped by the material each piece wears.
 *
 * Every slab is given its top face and cut off at a common floor underneath,
 * so nothing in the view can be seen from below and no two pieces leave a
 * seam of sky between them.
 */
export function buildHubApproach() {
  const e = ARENA_ENTRANCE
  const base = lobbyY(0) - 4

  const paving = []
  const steps = []
  const walkway = []
  const grass = []
  const wall = []
  const wallTop = []
  const podium = []
  const pad = []

  /** A block given the world Y of its top face, filled down to `base`. */
  const slab = (into, x, top, z, width, depth) => {
    const height = top - base
    into.push({ position: [x, top - height / 2, z], scale: [width, height, depth] })
  }

  // --- the ground the hub stands on ---------------------------------------
  const groundFrom = APPROACH_EDGE_Z
  const groundDepth = APPROACH_FAR_Z - groundFrom
  slab(grass, 0, lobbyY(0), groundFrom + groundDepth / 2, 150, groundDepth)

  // --- paving, and the lighter walkway down the middle ---------------------
  const plazaFrom = lobbyZ(PLAZA.to)
  const plazaTo = Math.min(APPROACH_FAR_Z, lobbyZ(PLAZA.from))
  const plazaDepth = plazaTo - plazaFrom
  const plazaZ = plazaFrom + plazaDepth / 2
  slab(paving, 0, lobbyY(PLAZA.pathHeight), plazaZ, PLAZA.halfWidth * 2, plazaDepth)
  walkway.push({
    position: [0, lobbyY(PLAZA.pathHeight) + 0.05, plazaZ],
    scale: [PLAZA.walkwayHalfWidth * 2, 0.1, plazaDepth],
  })

  // --- the landing, and the flight down ------------------------------------
  slab(steps, 0, 0, APPROACH_EDGE_Z + LANDING_DEPTH / 2, e.gapHalfWidth * 2, LANDING_DEPTH)
  for (let i = 0; i < e.stepCount; i++) {
    // Step i counts up from the plaza, exactly as `stairHeightAt` reads them.
    slab(
      steps,
      0,
      lobbyY((i + 1) * e.stepRise),
      lobbyZ(e.stepFromZ - (i + 0.5) * e.stepRun),
      e.gapHalfWidth * 2,
      e.stepRun * 1.02
    )
  }

  // --- the retaining walls flanking the stairs -----------------------------
  // Run back to the mouth rather than stopping where the hub stops them: from
  // this side the arena's own wall is what they have to meet.
  const wallTo = lobbyZ(e.wallFromZ)
  const wallDepth = wallTo - APPROACH_EDGE_Z
  const wallZ = APPROACH_EDGE_Z + wallDepth / 2
  const wallX = e.gapHalfWidth + e.wallWidth / 2
  for (const side of [-1, 1]) {
    slab(wall, side * wallX, lobbyY(e.wallHeight), wallZ, e.wallWidth, wallDepth)
    wallTop.push({
      position: [side * wallX, lobbyY(e.wallHeight) + 0.3, wallZ],
      scale: [e.wallWidth * 1.02, 0.6, wallDepth],
    })
  }

  // --- the raised tier carrying the back row of podiums --------------------
  const tierDepth = lobbyZ(LEFT_TIER.maxZ) - lobbyZ(LEFT_TIER.minZ)
  slab(
    wall,
    (LEFT_TIER.minX + LEFT_TIER.maxX) / 2,
    lobbyY(LEFT_TIER.height),
    lobbyZ(LEFT_TIER.minZ) + tierDepth / 2,
    LEFT_TIER.maxX - LEFT_TIER.minX,
    tierDepth
  )

  // --- the gallery and the training row ------------------------------------
  for (const p of PODIUMS) {
    const z = lobbyZ(p.position[2])
    if (z > APPROACH_FAR_Z) continue
    podium.push({
      position: [p.position[0], lobbyY(p.position[1]) + 0.7, z],
      scale: [2.4, 1.4, 2.4],
    })
  }
  for (const position of TRAINING_POSITIONS) {
    const z = lobbyZ(position[2])
    if (z > APPROACH_FAR_Z) continue
    pad.push({ position: [position[0], lobbyY(0) + 0.09, z], scale: [3.8, 0.18, 3.8] })
  }

  return { paving, steps, walkway, grass, wall, wallTop, podium, pad }
}

/**
 * Half-width of the widest prop at scale 1 - a tree's lower canopy.
 *
 * Props are inset from their block's edges by this much, so a canopy always
 * has terrace underneath it. Placing by trunk alone put the trunk on the block
 * and left the canopy hanging over the drop, which reads as a floating tree
 * however well planted the trunk actually is.
 */
const PROP_HALF_WIDTH = TREE_HALF_WIDTH

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

/* ------------------------------------------------------------- ground water */

/**
 * Pools, and what lies in and around them.
 *
 * A chamber was grass, rocks and a wall. The thing that makes the reference
 * arenas read as *places* is that the ground itself does something: a pond with
 * a pale shallow shelf round its edge and lily pads on it, or a crust of rock
 * with molten rock in the cracks. It is the same feature either way - a shaped
 * hole in the floor with something floating in it - so it is built once here
 * and coloured by the biome.
 *
 * The outline is a handful of overlapping rectangles rather than one, because
 * a rectangular pond reads as a swimming pool. Everything comes back as
 * instanced boxes: a whole waterway costs about six draw calls.
 */
/**
 * Whether a piece of this size can stand here.
 *
 * `blockedGround` asks about a *point*, which is right for a blade of grass and
 * wrong for a pond: the centre of a pool can be well clear of the fighting pad
 * while its far lobe lies across it, and a five-metre log dropped near the edge
 * hangs half of itself over the drop. Everything below is checked with its own
 * reach, and anything that does not fit is simply not built.
 */
function fitsOnFloor(x, z, spread) {
  // The fighting pad, and the doorway with its return pads either side.
  if (Math.hypot(x, z) - spread < ARENA.padRadius + 0.2) return false
  if (z - spread < ARENA.backZ + 5 && Math.abs(x) - spread < ARENA.gapHalfWidth + 4.6) return false
  // And inside the walls it is standing between.
  if (Math.abs(x) + spread > ARENA.halfWidth - 0.5) return false
  if (z + spread > ARENA.frontZ - 0.5 || z - spread < ARENA.backZ + 0.5) return false
  return true
}

/** How many places to try before giving up on a piece of scenery. */
const PLACEMENT_TRIES = 14

/**
 * Pools, and what lies in, on and across them.
 *
 * A chamber was grass, rocks and a wall. The thing that makes the reference
 * arenas read as *places* is that the ground itself does something: a pond with
 * a pale shallow shelf round its edge and lily pads on it, or a crust of rock
 * with molten rock in the cracks. It is the same feature either way - a shaped
 * hole in the floor with something over it - so it is built once here and
 * coloured by the biome.
 *
 * The outline is a handful of overlapping lobes rather than one rectangle,
 * because a rectangular pond reads as a swimming pool. Everything comes back as
 * instanced boxes: a whole waterway costs about seven draw calls.
 *
 * A place is *chosen* rather than tried once and abandoned - a level that asked
 * for three pools and got none because the first guess landed on the fighting
 * pad is a level that silently lost its scenery.
 *
 * `crust` turns the whole thing inside out for the molten biomes. Instead of a
 * pool with a few things floating on it, the surface is tiled with slabs that
 * very nearly touch, so what you read is a *rock floor with glowing cracks
 * through it* rather than an orange puddle - which is what the reference
 * volcano actually is.
 */
export function buildPools(seed = 0, count = 2, { crust = false, bridges = true } = {}) {
  const rand = makeRandom(31337 + seed * 5471)
  const basin = []
  const shallow = []
  const rim = []
  const pads = []
  const reeds = []
  const planks = []
  const posts = []

  const spanZ = ARENA.frontZ - ARENA.backZ

  for (let i = 0; i < count; i++) {
    /*
     * Kept modest on purpose. The floor is 26 across with a six-metre fighting
     * pad in the middle of it and a nine-metre doorway across the back, so the
     * room left for a pond is a band down each side - ask for a bigger one and
     * it simply cannot be placed anywhere, and the level ends up with no water
     * at all rather than with a smaller pond.
     */
    const reach = (crust ? 2.8 : 2.2) + rand() * 1.8

    // Somewhere it actually fits. Pools sit off to the sides: the middle of the
    // floor is where the fight happens, and a pond under the pack hides it.
    let cx = 0
    let cz = 0
    let placed = false
    for (let attempt = 0; attempt < PLACEMENT_TRIES; attempt++) {
      const side = rand() < 0.5 ? -1 : 1
      cx = side * (ARENA.padRadius + 1.5 + rand() * (ARENA.halfWidth - ARENA.padRadius - 4.5))
      cz = ARENA.backZ + 3 + rand() * (spanZ - 6)
      if (fitsOnFloor(cx, cz, reach * 0.8)) {
        placed = true
        break
      }
    }
    if (!placed) continue

    const lobes = 3 + Math.floor(rand() * 3)
    for (let l = 0; l < lobes; l++) {
      const angle = (l / lobes) * Math.PI * 2 + rand() * 0.7
      const drift = l === 0 ? 0 : reach * (0.3 + rand() * 0.5)
      const x = cx + Math.cos(angle) * drift
      const z = cz + Math.sin(angle) * drift
      const w = reach * (0.7 + rand() * 0.7)
      const d = reach * (0.7 + rand() * 0.7)

      // The pale shelf is the widest part, so it is what has to fit.
      if (!fitsOnFloor(x, z, Math.max(w, d) / 2 + 0.45)) continue

      /*
       * Two flat plates: a narrow pale shelf, and the deep water sitting a
       * hair proud of it. The shelf started three times this wide and swamped
       * the pool - what you want to read is water with a rim, not a rim with a
       * puddle in the middle of it.
       */
      /*
       * Under a crust the shelf is not a beach - it is the hotter melt showing
       * at the edge of the slabs, so it is a thin bright line rather than a
       * wide pale apron. At the full width it read as a sheet of yellow paper
       * laid on the floor.
       */
      const apron = crust ? 0.3 : 0.8
      shallow.push({ position: [x, 0.035, z], scale: [w + apron, 0.07, d + apron] })
      basin.push({ position: [x, 0.06, z], scale: [w, 0.07, d] })
    }

    // A broken kerb round the edge, which is what stops the pool looking like
    // a decal printed on the grass.
    const stones = 7 + Math.floor(rand() * 6)
    for (let s = 0; s < stones; s++) {
      const angle = (s / stones) * Math.PI * 2 + rand() * 0.4
      const out = reach * (1.15 + rand() * 0.35)
      const height = 0.16 + rand() * 0.24
      const width = 0.5 + rand() * 0.7
      const x = cx + Math.cos(angle) * out
      const z = cz + Math.sin(angle) * out
      if (!fitsOnFloor(x, z, width / 2)) continue
      rim.push({
        position: [x, height / 2, z],
        scale: [width, height, 0.5 + rand() * 0.7],
        rotation: rand() * Math.PI,
      })
    }

    if (crust) {
      /*
       * A cracked crust rather than a pool with things floating on it.
       *
       * Slabs are laid on a jittered grid and cut a little short of their own
       * cell, so what is left between them is a network of thin glowing lines.
       * Standing proud of the surface rather than flush with it is what makes
       * them read as *plates over* the lava instead of islands in it.
       */
      const cell = 1.75
      const across = Math.ceil((reach * 2.1) / cell)
      for (let gx = -across; gx <= across; gx++) {
        for (let gz = -across; gz <= across; gz++) {
          const jitterX = (rand() - 0.5) * 0.3
          const jitterZ = (rand() - 0.5) * 0.3
          const x = cx + gx * cell + jitterX
          const z = cz + gz * cell + jitterZ
          // Only inside the pool's own rough outline.
          if (Math.hypot(x - cx, z - cz) > reach * 1.05) continue
          const gap = 0.26 + rand() * 0.28
          const w = cell - gap
          const d = cell - gap
          if (!fitsOnFloor(x, z, Math.max(w, d) / 2)) continue
          pads.push({
            position: [x, 0.17, z],
            scale: [w, 0.26, d],
            rotation: (rand() - 0.5) * 0.14,
          })
        }
      }
    } else {
      // Floating on it: lily pads, flat on the surface.
      const floating = 3 + Math.floor(rand() * 4)
      for (let p = 0; p < floating; p++) {
        const angle = rand() * Math.PI * 2
        const out = reach * rand() * 0.75
        const size = 0.9 + rand() * 1.1
        const x = cx + Math.cos(angle) * out
        const z = cz + Math.sin(angle) * out
        if (!fitsOnFloor(x, z, size / 2)) continue
        pads.push({
          position: [x, 0.11, z],
          scale: [size, 0.08, 0.9 + rand() * 1.1],
          rotation: rand() * Math.PI,
        })
      }

      // And standing in the shallows at the edge.
      const stalks = 5 + Math.floor(rand() * 6)
      for (let r = 0; r < stalks; r++) {
        const angle = rand() * Math.PI * 2
        const out = reach * (0.85 + rand() * 0.3)
        const height = 0.8 + rand() * 1.1
        const x = cx + Math.cos(angle) * out
        const z = cz + Math.sin(angle) * out
        if (!fitsOnFloor(x, z, 0.4)) continue
        reeds.push({
          position: [x, height / 2, z],
          scale: [0.5 + rand() * 0.3, height, 0.5 + rand() * 0.3],
          rotation: rand() * Math.PI,
          tilt: (rand() - 0.5) * 0.45,
        })
      }
    }

    /*
     * A plank walk across it.
     *
     * Two thirds of pools get one. It is the one piece of scenery in the
     * chamber that somebody *built*, which is what makes the level read as a
     * place people pass through rather than a landscape - and it gives the
     * water a reason to be crossed rather than waded.
     */
    if (bridges && rand() < 0.66) {
      const dir = rand() * Math.PI
      const span = reach * 2.2
      const cos = Math.cos(dir)
      const sin = Math.sin(dir)
      const count_ = Math.max(4, Math.round(span / 0.62))
      const width = 2 + rand() * 0.7

      /*
       * A bridge is a line, not a disc. Asking whether a circle the length of
       * the whole span fits is the wrong question - it never does, and the
       * first version silently built no bridges anywhere. Each plank is
       * checked where it actually lies, and the walkway is only laid if nearly
       * all of it has somewhere to be: half a bridge is worse than none.
       */
      const wanted = []
      for (let b = 0; b < count_; b++) {
        const t = -0.5 + b / (count_ - 1)
        const px = cx + cos * t * span
        const pz = cz + sin * t * span
        if (!fitsOnFloor(px, pz, width / 2)) continue
        wanted.push({
          position: [px, 0.42, pz],
          scale: [0.46, 0.14, width],
          rotation: -dir,
          // A plank or two sitting askew is what stops it reading as a ruler.
          tilt: (rand() - 0.5) * 0.06,
        })
      }

      if (wanted.length >= count_ * 0.8) {
        planks.push(...wanted)

        // Posts under both ends, so the walkway stands on something.
        for (const end of [-0.5, 0.5]) {
          for (const side of [-1, 1]) {
            const qx = cx + cos * end * span - sin * side * (width / 2 - 0.2)
            const qz = cz + sin * end * span + cos * side * (width / 2 - 0.2)
            if (!fitsOnFloor(qx, qz, 0.2)) continue
            posts.push({
              position: [qx, 0.2, qz],
              scale: [0.28, 0.42, 0.28],
              rotation: -dir,
            })
          }
        }
      }
    }
  }

  return { basin, shallow, rim, pads, reeds, planks, posts }
}

/**
 * Fallen timber.
 *
 * One long block lying across the floor does more to make a clearing feel
 * lived-in than a dozen more pebbles: it is the only thing out there with a
 * direction to it, and it breaks the grid the rest of the scatter sits on.
 */
export function buildLogs(seed = 0, count = 3) {
  const rand = makeRandom(70707 + seed * 3313)
  const trunks = []
  const stubs = []

  const spanZ = ARENA.frontZ - ARENA.backZ

  for (let i = 0; i < count; i++) {
    const length = 4 + rand() * 4
    const thickness = 0.5 + rand() * 0.35
    const rotation = rand() * Math.PI

    // A log is long, so where its *ends* land is the question, not its middle.
    let x = 0
    let z = 0
    let placed = false
    for (let attempt = 0; attempt < PLACEMENT_TRIES; attempt++) {
      x = (rand() - 0.5) * 2 * (ARENA.halfWidth - 3)
      z = ARENA.backZ + 2 + rand() * (spanZ - 4)
      if (fitsOnFloor(x, z, length / 2)) {
        placed = true
        break
      }
    }
    if (!placed) continue

    trunks.push({
      position: [x, thickness / 2, z],
      scale: [length, thickness, thickness],
      rotation,
    })

    // A snapped branch or two, so it reads as fallen rather than delivered.
    const branches = 1 + Math.floor(rand() * 2)
    for (let b = 0; b < branches; b++) {
      const along = (rand() - 0.5) * length * 0.7
      const out = (rand() < 0.5 ? -1 : 1) * (0.4 + rand() * 0.5)
      const bx = x + Math.cos(rotation) * along - Math.sin(rotation) * out
      const bz = z + Math.sin(rotation) * along + Math.cos(rotation) * out
      if (!fitsOnFloor(bx, bz, 0.9)) continue
      stubs.push({
        position: [bx, thickness * (0.5 + rand() * 0.5), bz],
        scale: [0.9 + rand() * 0.8, thickness * 0.55, thickness * 0.55],
        rotation: rotation + (rand() - 0.5) * 1.4,
        tilt: (rand() - 0.5) * 0.5,
      })
    }
  }

  return { trunks, stubs }
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

    // The direction pointing from this block back into the arena. The mouth
    // wall faces the other way down Z from the back wall it mirrors.
    const inward =
      block.face === 'side'
        ? [-Math.sign(bx) || 1, 0]
        : block.face === 'front'
          ? [0, -1]
          : [0, 1]

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

/**
 * How many levels stay built either side of the one you are in.
 *
 * Three each way, which is as far as the fog reaches. Everything that belongs
 * to a chamber is mounted for all of them - the ground, the walls, and the
 * gateways - because a corridor of chambers with a gateway in only one of them
 * reads as a corridor that stops being a level the moment you look down it.
 */
export const CHAMBERS_BEHIND = 3
export const CHAMBERS_AHEAD = 3

/** The levels currently standing, nearest the player first is not required. */
export function chamberWindow(stageIndex, maxStages = Infinity) {
  const out = []
  for (let k = stageIndex - CHAMBERS_BEHIND; k <= stageIndex + CHAMBERS_AHEAD; k++) {
    if (k >= 0 && k < maxStages) out.push(k)
  }
  return out
}

/** Half-width of the passage through the back wall between two chambers. */
export const PASSAGE_HALF_WIDTH = ARENA.gapHalfWidth - 0.8

/**
 * Where one chamber's stretch of corridor ends and the next one's begins.
 *
 * The plane sits in the gap cut through a chamber's back wall, so the level
 * you are credited with is simply the level you are standing in: walk through
 * the gap and you are in the next one, walk back through it and you are in the
 * one you came from.
 *
 * One plane answering it in both directions is what lets the corridor be
 * walked in reverse. The gates used to decide it instead, and each fired in
 * one fixed direction - so stepping back through an open exit ran the
 * *forward* gate again and shoved you straight back where you came from.
 */
export const BOUNDARY_LOCAL_Z = ARENA.backZ - 1.5

/**
 * Dead band either side of a boundary.
 *
 * Standing exactly on the plane would otherwise flip the level back and forth
 * every frame, and crossing forward has consequences - it is the plane the
 * damage check hangs off.
 */
export const BOUNDARY_MARGIN = 0.4

/** World Z of the boundary between `stageIndex` and the level after it. */
export function stageBoundaryZ(stageIndex) {
  return chamberOrigin(stageIndex) + BOUNDARY_LOCAL_Z
}

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
 * How much room there is either side of the centre line at a given Z.
 *
 * The corridor repeats: a chamber, then sixteen units of wall with a doorway
 * cut through it, then the next chamber. This is that profile as a *continuous*
 * function, and the continuity is the point. Read as a step - wide, then
 * abruptly the width of a doorway - it threw the camera eight metres sideways
 * the instant a boundary was crossed, which is exactly where a boundary is
 * crossed: walking a level forward or back.
 */
const WALL_ENTERS = -ARENA.backZ
const WALL_LEAVES = -ARENA.backZ + MOUTH_DEPTH
/**
 * How far ahead of a wall it starts closing in.
 *
 * The taper runs *up to* the wall's face and is fully closed the moment the
 * band begins - never the other way round. Blending across the first few units
 * of the wall itself would leave the camera nine metres wide of centre while
 * already inside it, which is the exact failure the clamp exists to prevent:
 * the boxes are single-sided, so from in there the wall stops being drawn and
 * the trees on top of it hang in an empty sky.
 */
const WALL_BLEND = 5

export function corridorHalfWidthAt(z, margin = 1.4) {
  const wide = ARENA.halfWidth - margin
  // The camera is allowed right up to a wall; it just may not go inside one.
  const narrow = Math.max(0.5, PASSAGE_HALF_WIDTH - margin * 0.5)

  // Where this point falls in the repeating pattern.
  const u = ((-z % CHAMBER_SPAN) + CHAMBER_SPAN) % CHAMBER_SPAN
  const into = Math.min(u - (WALL_ENTERS - WALL_BLEND), WALL_LEAVES + WALL_BLEND - u)

  if (into <= 0) return wide
  if (into >= WALL_BLEND) return narrow
  return wide + (narrow - wide) * (into / WALL_BLEND)
}

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
/** Closest the barrier limit may push the camera to the dino. */
const MIN_GATE_GAP = 4.5

export function clampToCorridor(point, player = null, sealedZ = null, margin = 1.4) {
  const squeeze = () => {
    const halfWidth = corridorHalfWidthAt(point.z, margin)
    if (point.x > halfWidth) point.x = halfWidth
    else if (point.x < -halfWidth) point.x = -halfWidth
  }

  squeeze()

  /*
   * A sealed gate is the one thing the camera may not go behind: the barrier
   * is translucent from that side and washes the whole screen out.
   *
   * `sealedZ` is null the moment the chamber is clear, which is what keeps
   * this out of the way while a boundary is being crossed - the old version
   * asked whether the *player* was inside the hollow, and switched off the
   * instant they stepped into the passage, teleporting the camera ten metres.
   * An open gate needs no limit anyway: the width profile above already keeps
   * the camera out of the wall it is cut through.
   */
  if (sealedZ !== null) {
    // Never inside the dino either. Pressed up against the gate there is no
    // room on that side at all, and glimpsing the barrier is the lesser evil.
    const limit = player ? Math.min(sealedZ, player.z - MIN_GATE_GAP) : sealedZ
    if (point.z < limit) {
      point.z = limit
      squeeze()
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
 * Fewest blows a chamber can be cleared in, however over-geared you are.
 *
 * A pack of five already takes five - one per enemy - but a boss stands alone,
 * and a boss that pops in a single click is not a boss. This is the floor that
 * keeps every fight long enough to be a fight.
 */
export const MIN_HITS_TO_CLEAR = 4

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

/**
 * The gateway's structure sits in the *middle* of the wall it is cut through,
 * not against its near face.
 *
 * Standing at the face the pillars read as two towers parked in front of a
 * wall with a hole in it. Set into the sixteen units of the wall itself they
 * read as what they are: a gateway through it, framed by the rock on both
 * sides.
 */
export const EXIT_GATE = {
  position: [0, 0, ARENA.backZ - MOUTH_DEPTH / 2],
  radius: 3.2,
}

/**
 * The barrier hangs between the towers, not at the chamber's edge.
 *
 * It is the gate: a sheet of light strung across the gateway itself reads as
 * one thing with the pillars holding it, where a pane floating ten metres in
 * front of them read as a second, unrelated wall.
 */
export const EXIT_BARRIER_Z = EXIT_GATE.position[2]

/**
 * The sign, though, stays at the chamber's own edge - it is addressed to
 * somebody standing in the chamber, and set into the tunnel it would be hidden
 * by the wall from everywhere but dead centre.
 */
export const EXIT_SIGN_Z = ARENA.backZ + 1.6

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

/**
 * Where a dino standing at (x, z) should be carried to, or null to stay put.
 *
 * The whole rule for moving along the corridor, as one pure function of where
 * you are - which is what lets it be walked in both directions. The gates used
 * to own a direction each and fire on proximity, so stepping back through an
 * open exit ran the forward one again and pushed you into the level you were
 * trying to leave.
 *
 * A return of -1 means out of the near end of Stage 1: the mouth of the arena.
 */
export function stageTravelTarget(stageIndex, x, z) {
  // Forward, out through the gap in this chamber's back wall. Nothing here
  // stops you doing it early - the sealed barrier does, by way of the
  // player's own bounds, which end at the gate until the pack is down.
  if (z < stageBoundaryZ(stageIndex) - BOUNDARY_MARGIN) return stageIndex + 1

  // Back, over the very same plane the level behind uses as its front edge.
  if (stageIndex > 0) {
    return z > stageBoundaryZ(stageIndex - 1) + BOUNDARY_MARGIN ? stageIndex - 1 : null
  }

  /*
   * Stage 1 has nothing behind it, so its near end is the way out and walking
   * through banks the run. Narrow, and only at the mouth itself, so brushing
   * along the front wall on the way to a Return pad never cashes you out.
   */
  const mouth = chamberOrigin(0) + ENTRY_TRIGGER.z - ENTRY_TRIGGER.radius
  if (z >= mouth && Math.abs(x) <= ARENA.gapHalfWidth) return -1

  return null
}

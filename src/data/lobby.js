import { EVOLUTIONS } from './evolutions.js'
import { TREE_HALF_WIDTH } from './foliage.js'
import { TRAINING_PADS } from './training.js'

/**
 * Lobby hub layout.
 *
 * The hub is split down the middle: all thirteen stage podiums line the LEFT
 * side in two rows stepped like a staircase - seven at plaza level, six on a
 * raised tier behind them - and every training pad runs down the RIGHT side.
 * You spawn at the near end and the arena gate caps the far end.
 *
 * Every position and dimension lives here so the level can be re-laid-out
 * without touching a component.
 *
 * Axes: the plaza runs along -Z (away from the camera). +X is right.
 */

/* ------------------------------------------------------------------ ground */

export const PLAZA = {
  /** Walkable half-width and length of the paved area. */
  halfWidth: 28,
  from: 26,
  to: -48,
  /** Height of the raised path above the grass. */
  pathHeight: 0.25,
  /** Half-width of the central walkway stripe. */
  walkwayHalfWidth: 5,
}

/** Keeps the player inside the plaza without needing collision meshes. */
export const PLAYER_BOUNDS = {
  minX: -PLAZA.halfWidth + 1.2,
  maxX: PLAZA.halfWidth - 1.2,
  minZ: PLAZA.to + 2.5,
  maxZ: PLAZA.from - 2,
}

export const PLAYER_SPEED = 8.5
export const PLAYER_TURN_SPEED = 10

/** Where the player stands when the hub loads. */
export const PLAYER_SPAWN = [0, 0, 18]

/* ----------------------------------------------------------------- palette */

export const LOBBY_PALETTE = {
  skyTop: '#2f7fd4',
  skyBottom: '#9fd4f5',
  fog: '#bfe0f2',
  fogNear: 60,
  fogFar: 170,
  grass: '#5fbb46',
  grassDark: '#4a9c37',
  /** Paving either side of the walkway. */
  path: '#b9c2cd',
  /** The lighter walkway running down the middle. */
  walkway: '#dde4ec',
  pathEdge: '#8e99a8',
  wall: '#b08968',
  wallTop: '#8c6a4f',
  key: '#fff6e0',
  ambient: '#cfe8ff',
}

/* ------------------------------------------------------------ left tier */

/**
 * The raised step carrying the back row of podiums, and the stairs up to it.
 * A single height lookup keeps the player's feet on whichever surface they are
 * standing on without needing terrain collision.
 *
 * It runs the length of the gallery it carries, so widening the spacing
 * between podiums lengthens this too - a back-row dino turning at the end of
 * the row must still have tier under it.
 */
export const LEFT_TIER = {
  minX: -23,
  maxX: -13.4,
  minZ: -30,
  maxZ: 17,
  height: 2.4,
}

export const LEFT_STAIRS = {
  minX: LEFT_TIER.minX,
  maxX: LEFT_TIER.maxX,
  /** Steps run from the plaza up to the tier's near edge. */
  fromZ: LEFT_TIER.maxZ,
  toZ: LEFT_TIER.maxZ + 4.8,
  steps: 4,
}

/** Surface height under a point: plaza, stairs, or the raised tier. */
export function groundHeightAt(x, z) {
  const stair = stairHeightAt(x, z)
  if (stair !== null) return stair

  // The grass ledges either side of the entrance, one mirrored onto the other.
  const shoulder = ENTRANCE_SHOULDERS
  if (
    Math.abs(x) >= shoulder.minX &&
    Math.abs(x) <= shoulder.maxX &&
    z >= shoulder.minZ &&
    z <= shoulder.maxZ
  ) {
    return shoulder.height
  }

  if (x >= LEFT_TIER.minX && x <= LEFT_TIER.maxX) {
    if (z >= LEFT_TIER.minZ && z <= LEFT_TIER.maxZ) return LEFT_TIER.height
    if (z > LEFT_STAIRS.fromZ && z <= LEFT_STAIRS.toZ) {
      const span = LEFT_STAIRS.toZ - LEFT_STAIRS.fromZ
      // Nearest the plaza is the bottom step; nearest the tier is the top.
      const t = 1 - (z - LEFT_STAIRS.fromZ) / span
      const step = Math.min(LEFT_STAIRS.steps, Math.floor(t * LEFT_STAIRS.steps) + 1)
      return (step / LEFT_STAIRS.steps) * LEFT_TIER.height
    }
  }
  return 0
}

/* ---------------------------------------------------------- stage podiums */

/** Spacing between podiums down each row. */
export const PODIUM_SPACING = 7.2

/**
 * How far a dino reaches from its own origin - the tip of a spiked tail.
 *
 * A podium dino turns on the spot, so this is the radius it sweeps, and it is
 * far larger than the pad under it: the model is nearly six units long against
 * a pad of four and a half.
 */
export const DINO_SWEEP_REACH = 4.26

/**
 * How far it reaches the other way - the tip of its snout.
 *
 * A dino is not centred on its own hip, which is where the podium used to turn
 * it: the tail is nearly three times as long as the head is deep, so the whole
 * animal orbited the pedestal instead of turning on it. Rotate about the
 * midpoint of the two and the circle it needs shrinks by a third.
 */
export const DINO_HEAD_REACH = 1.6

/** Where the model has to sit so the podium turns it about its own middle. */
export const DINO_CENTRE_OFFSET = (DINO_SWEEP_REACH - DINO_HEAD_REACH) / 2

/**
 * Half the animal's length, which is what it occupies once centred.
 *
 * It no longer turns - a podium dino stands facing the walkway, the way the
 * gallery in the game this is modelled on displays them - so this is a static
 * half-length along X rather than a swept radius. It is the same number either
 * way, which is why centring the model was worth doing before the spin went.
 */
export const DINO_HALF_LENGTH = (DINO_SWEEP_REACH + DINO_HEAD_REACH) / 2

/** And how wide it is across, which is all it needs between neighbours now. */
export const DINO_HALF_WIDTH = 0.75

/**
 * How big a dino stands on its podium, against its own scale.
 *
 * It was 0.62 turning about the hip, which had the late tiers sweeping four and
 * a half units on a row spaced six apart: they overlapped their neighbours by
 * nearly three units, hung off the tier they stood on, and swung their tails
 * through the retaining wall behind the front row. Dropping to 0.4 fixed that
 * by making them small.
 *
 * Turning them about their own middle instead buys back a third of the circle,
 * and that is what pays for this: 0.58 is nearly half again the size of 0.4 and
 * still clears the wall, the tier edge and the next podium along - see the
 * numbers in the layout test.
 */
export const PODIUM_DINO_SCALE = 0.78
/** First podium sits this far down the plaza. */
export const PODIUM_START_Z = 12
/** How close the player must stand to interact. */
export const INTERACT_RADIUS = 3.2

/**
 * Two rows on the left, stepped like a staircase: stages 1-7 at plaza level
 * and stages 8-13 on the raised tier behind them, so the whole progression is
 * visible from the walkway at once.
 */
export const PODIUM_ROWS = [
  { x: -10.2, y: 0, count: 7 },
  { x: -18, y: LEFT_TIER.height, count: 6 },
]

/**
 * `unlockAtWins` from data/evolutions.js doubles as the podium's requirement,
 * so the gallery and the unlock thresholds can never drift apart.
 */
export const PODIUMS = EVOLUTIONS.map((evolution, index) => {
  const row = index < PODIUM_ROWS[0].count ? 0 : 1
  const slot = row === 0 ? index : index - PODIUM_ROWS[0].count
  const def = PODIUM_ROWS[row]
  return {
    id: evolution.id,
    evolutionIndex: index,
    row,
    position: [def.x, def.y, PODIUM_START_Z - slot * PODIUM_SPACING],
  }
})

/* ----------------------------------------------------------- training pads */

export const TRAINING_PADS_LAYOUT = TRAINING_PADS

/**
 * Every training pad runs down the right-hand side of the plaza, out by the
 * fence rather than beside the walkway - the middle of the hub belongs to the
 * path between the gallery and the arena.
 */
export const TRAINING_ROW = {
  x: 19,
  startZ: 16,
  /*
   * Short enough that the last machine stops well clear of the entrance's
   * grass shoulder. The row used to run to z=-35.6 with the shoulder beginning
   * at -35, so the deepest treadmill was buried in a bank of grass.
   */
  spacing: -5.6,
}

export const TRAINING_POSITIONS = TRAINING_PADS.map((_, i) => [
  TRAINING_ROW.x,
  0,
  TRAINING_ROW.startZ + i * TRAINING_ROW.spacing,
])

/* ------------------------------------------------------- rebirth pedestals */

/** Rebirth milestones shown on the pedestal row. */
export const REBIRTH_PEDESTALS = [
  { rebirths: 1, label: 'x1.5 Power' },
  { rebirths: 3, label: 'x2.5 Power' },
  { rebirths: 5, label: 'x3.5 Power' },
]

/** Rebirth monuments stand in an arc across the entrance. */
export const REBIRTH_ROW = {
  z: 21.5,
  startX: -4,
  spacing: 7.5,
}

export const REBIRTH_POSITIONS = REBIRTH_PEDESTALS.map((_, i) => [
  REBIRTH_ROW.startX + i * REBIRTH_ROW.spacing,
  0,
  REBIRTH_ROW.z,
])

/* -------------------------------------------------------------- arena gate */

/** Portal at the end of the plaza that drops you into the battle arena. */
/**
 * The travel trigger, part-way up the staircase rather than at its foot, so
 * the climb between the walls actually reads before the scene changes.
 */
export const ARENA_GATE = {
  position: [0, 0, -45],
  radius: 1.6,
}

/* -------------------------------------------------------- arena entrance */

/**
 * The way out of the hub: a carpeted staircase climbing between two tall
 * retaining walls, with the arena beyond the top.
 *
 * The stairs are real geometry that `groundHeightAt` knows about, so the dino
 * physically walks up them, and the walls are backed by a short row of
 * collision circles so you cannot stroll around the side of the gateway.
 */
/*
 * The entrance sits at the far end of a longer plaza than it used to.
 *
 * Its retaining walls are ten units thick and start at `wallFromZ`, and the
 * gallery's last front-row podium was standing inside the left one - a
 * Tyrannosaur buried to the shoulder in coursed stone. Moving the whole
 * entrance back is what makes room for the gallery to move back with it, which
 * is the other half of the same problem: the row had nowhere left to go.
 */
export const ARENA_ENTRANCE = {
  /** Half-width of the walkable corridor between the walls. */
  gapHalfWidth: 3.6,
  wallWidth: 10,
  wallHeight: 11,
  /** Walls run from the plaza end (near) to well past the stair top (far). */
  wallFromZ: -38,
  wallToZ: -52,
  /** Staircase. */
  stepCount: 10,
  stepRise: 0.62,
  stepRun: 1.45,
  stepFromZ: -40.5,
  /**
   * Grass shoulder either side of the walls.
   *
   * Under the height a standing jump clears - `JUMP_SPEED` against `GRAVITY`
   * reaches about 2.06 - so the ledge either side of the gateway is somewhere
   * you can get up onto rather than a wall you bounce off.
   */
  shoulderHeight: 1.8,
}

/**
 * The two grass ledges flanking the entrance, as a footprint.
 *
 * The mesh for these lives in the ArenaGate component, but the surface has to
 * be known here: the player used to walk straight through them, standing at
 * plaza level inside a block of raised grass.
 */
export const ENTRANCE_SHOULDERS = (() => {
  const e = ARENA_ENTRANCE
  const centre = e.gapHalfWidth + e.wallWidth / 2 + e.wallWidth / 2 + 6
  const midZ = (e.wallFromZ + e.wallToZ) / 2
  const depth = e.wallFromZ - e.wallToZ + 6
  return {
    minX: centre - 6,
    maxX: centre + 6,
    minZ: midZ - depth / 2,
    maxZ: midZ + depth / 2,
    height: e.shoulderHeight,
  }
})()

/** Z of the top of the staircase. */
export const ARENA_STAIR_TOP_Z =
  ARENA_ENTRANCE.stepFromZ - ARENA_ENTRANCE.stepCount * ARENA_ENTRANCE.stepRun

/** Height of the staircase surface at a point, or null when off the stairs. */
export function stairHeightAt(x, z) {
  const e = ARENA_ENTRANCE
  if (Math.abs(x) > e.gapHalfWidth) return null
  if (z > e.stepFromZ || z < ARENA_STAIR_TOP_Z) return null
  const step = Math.floor((e.stepFromZ - z) / e.stepRun) + 1
  return Math.min(e.stepCount, step) * e.stepRise
}

/* --------------------------------------------------------------- collision */

/**
 * Solid props, as circles. The hub has no dynamic obstacles, so pushing the
 * player out of a handful of radii each frame is all the collision it needs -
 * far cheaper than putting the whole level into a physics world.
 *
 * Training pads are deliberately absent: you are meant to stand on those.
 */
export const PODIUM_RADIUS = 2.3
export const PEDESTAL_RADIUS = 1.8

/**
 * The entrance walls, as a row of circles down each inner face. Long slabs do
 * not fit the circle-push collision the hub uses, but a line of overlapping
 * circles along the face gives the same result for a fraction of the work.
 */
/*
 * The radius has to be half the wall, not a third of it.
 *
 * At three it covered only the inner six units of a wall ten units thick, so
 * you could walk into the outer half and stand inside coursed stone. Sized to
 * the wall and centred on it, a circle spans exactly the block it stands for -
 * pushing you out into the gateway on one side or onto the grass shoulder on
 * the other, whichever you came from.
 */
const ENTRANCE_WALL_RADIUS = ARENA_ENTRANCE.wallWidth / 2
const ENTRANCE_WALL_OBSTACLES = (() => {
  const out = []
  const e = ARENA_ENTRANCE
  const centre = e.gapHalfWidth + ENTRANCE_WALL_RADIUS
  // Overlapping, so there is no gap between one circle and the next to slip
  // through at the corners.
  const step = ENTRANCE_WALL_RADIUS * 0.6
  for (let z = e.wallFromZ; z >= PLAYER_BOUNDS.minZ - step; z -= step) {
    out.push({ x: -centre, z, radius: ENTRANCE_WALL_RADIUS })
    out.push({ x: centre, z, radius: ENTRANCE_WALL_RADIUS })
  }
  return out
})()

export const OBSTACLES = [
  ...PODIUMS.map((p) => ({ x: p.position[0], z: p.position[2], radius: PODIUM_RADIUS })),
  ...REBIRTH_POSITIONS.map((p) => ({ x: p[0], z: p[2], radius: PEDESTAL_RADIUS })),
  ...ENTRANCE_WALL_OBSTACLES,
]

/**
 * Pushes a point into the plaza's open space.
 *
 * Same reason as the arena's clamp: the terraces and the arena entrance walls
 * are single-sided boxes, so a camera swung into one sees through it and the
 * hub falls apart around the player.
 *
 * Mutates and returns the vector.
 */
export function clampToPlaza(point, margin = 1.2) {
  const halfWidth = PLAZA.halfWidth - margin
  if (point.x > halfWidth) point.x = halfWidth
  else if (point.x < -halfWidth) point.x = -halfWidth

  // Past the plaza's far end the only open ground is the gateway itself.
  if (point.z < ARENA_ENTRANCE.wallFromZ) {
    const gap = ARENA_ENTRANCE.gapHalfWidth - margin * 0.5
    if (point.x > gap) point.x = gap
    else if (point.x < -gap) point.x = -gap
  }

  return point
}

/* ----------------------------------------------------------------- scenery */

/**
 * Grass terraces stepping away from the plaza. Shared by the ground mesh and
 * the tree scatter so trees always stand on a step rather than floating.
 */
export const TERRACES = [
  { offset: PLAZA.halfWidth + 6, height: 1.6, width: 12 },
  { offset: PLAZA.halfWidth + 17, height: 3.4, width: 12 },
  { offset: PLAZA.halfWidth + 28, height: 5.6, width: 14 },
]

/**
 * Grass blades tufting the terraces that frame the plaza.
 *
 * They sit on the terrace tops only - never on the paving or the walkway - so
 * the hub gets the same overgrown edges as the arena without anything sprouting
 * where the player actually walks.
 */
export function lobbyTufts(clusters = 150) {
  const items = []
  let seed = 8112024
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  const fromZ = PLAZA.to - 6
  const spanZ = PLAZA.from - fromZ + 10

  for (let i = 0; i < clusters; i++) {
    const terrace = TERRACES[i % TERRACES.length]
    const side = i % 2 === 0 ? -1 : 1
    const cx = side * (terrace.offset + (rand() - 0.5) * (terrace.width - 1.5))
    const cz = fromZ + rand() * spanZ

    const blades = 2 + Math.floor(rand() * 3)
    for (let b = 0; b < blades; b++) {
      const height = 0.5 + rand() * 0.5
      items.push({
        position: [cx + (rand() - 0.5) * 1.2, terrace.height + height / 2, cz + (rand() - 0.5) * 1.2],
        scale: [0.8 + rand() * 0.5, height, 0.8 + rand() * 0.5],
        rotation: rand() * Math.PI,
        tilt: (rand() - 0.5) * 0.2,
      })
    }
  }

  return items
}

/**
 * The individual stones of a wall face.
 *
 * A brick *texture* on one big slab reads as a photograph of a wall; real
 * blocks standing a few centimetres proud of it read as a wall. This lays a
 * grid of them over a face, courses offset like real masonry, each one nudged
 * so the surface is never perfectly flat.
 *
 * `axis` says which way the face runs: 'z' for the long flanks either side of
 * the plaza, 'x' for the ends. Returns items ready for InstancedBlocks.
 */
export function wallStones({
  axis = 'z',
  from,
  to,
  faceAt,
  baseY = 0,
  height,
  block = 2.2,
  depth = 0.32,
  seed = 11,
}) {
  let state = seed * 2654435761 % 4294967296
  const rand = () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }

  const items = []
  const rows = Math.max(1, Math.round(height / block))
  const rowHeight = height / rows
  const span = Math.abs(to - from)
  const start = Math.min(from, to)

  for (let row = 0; row < rows; row++) {
    // Every other course steps half a block along, the way stone is laid.
    const offset = row % 2 === 0 ? 0 : block / 2
    const columns = Math.max(1, Math.ceil((span - offset) / block))
    const width = (span - offset) / columns

    for (let col = 0; col < columns; col++) {
      const along = start + offset + width * (col + 0.5)
      const y = baseY + rowHeight * (row + 0.5)
      // A hair of variation in how far each stone stands out.
      const proud = depth * (0.75 + rand() * 0.5)

      items.push({
        position:
          axis === 'z' ? [faceAt, y, along] : [along, y, faceAt],
        scale:
          axis === 'z'
            ? [proud * 2, rowHeight * 0.9, width * 0.92]
            : [width * 0.92, rowHeight * 0.9, proud * 2],
      })
    }
  }

  return items
}

/**
 * Bright toy blocks stacked around the hub's edges.
 *
 * The hub was green, grey and brown - honest, and a bit sober for a game about
 * cartoon dinosaurs. These are just stacks of primary-coloured cubes sitting on
 * the terraces, the way a box of bricks looks when it has been tipped out, and
 * they do more for the place than any amount of extra terrain would.
 *
 * `tone` indexes the colour list in the ground component; blocks are drawn one
 * instanced mesh per colour, so seventy of them cost five draw calls.
 */
export function lobbyBlocks(stacks = 46, tones = 5) {
  const items = []
  let seed = 90210
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  const fromZ = PLAZA.to - 4
  const spanZ = PLAZA.from - fromZ + 8

  for (let i = 0; i < stacks; i++) {
    const terrace = TERRACES[i % TERRACES.length]
    const side = i % 2 === 0 ? -1 : 1
    const cx = side * (terrace.offset + (rand() - 0.5) * (terrace.width - 3))
    const cz = fromZ + rand() * spanZ

    // One to three cubes, each a little smaller and turned off the one below.
    const height = 1 + Math.floor(rand() * 3)
    let base = terrace.height
    let size = 1.5 + rand() * 0.9

    for (let level = 0; level < height; level++) {
      items.push({
        position: [cx + (rand() - 0.5) * 0.4, base + size / 2, cz + (rand() - 0.5) * 0.4],
        scale: size,
        rotation: rand() * Math.PI,
        tone: Math.floor(rand() * tones),
      })
      base += size
      size *= 0.78
    }
  }

  return items
}

/** Blocky pines on the terraces, laid out deterministically. */
export function treeLayout(count = 46) {
  const trees = []
  let seed = 20240904
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const terrace = TERRACES[i % TERRACES.length]
    const t = i / count
    const scale = 0.9 + rand() * 0.85
    // Inset by the canopy's own half-width, so no tree hangs over the terrace
    // edge with nothing underneath it.
    const room = Math.max(0, terrace.width / 2 - TREE_HALF_WIDTH * scale)

    trees.push({
      position: [
        side * (terrace.offset + (rand() - 0.5) * 2 * room),
        0,
        PLAZA.from + 6 - t * (PLAZA.from - PLAZA.to + 22) - rand() * 4,
      ],
      terraceHeight: terrace.height,
      scale,
      rotation: rand() * Math.PI,
    })
  }
  return trees
}

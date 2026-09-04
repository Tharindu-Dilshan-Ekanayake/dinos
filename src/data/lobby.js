import { EVOLUTIONS } from './evolutions.js'
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
  halfWidth: 24,
  from: 26,
  to: -34,
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
 */
export const LEFT_TIER = {
  minX: -21.5,
  maxX: -12.6,
  minZ: -22,
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
export const PODIUM_SPACING = 6.2
/** First podium sits this far down the plaza. */
export const PODIUM_START_Z = 13
/** How close the player must stand to interact. */
export const INTERACT_RADIUS = 3.2

/**
 * Two rows on the left, stepped like a staircase: stages 1-7 at plaza level
 * and stages 8-13 on the raised tier behind them, so the whole progression is
 * visible from the walkway at once.
 */
export const PODIUM_ROWS = [
  { x: -9.4, y: 0, count: 7 },
  { x: -17, y: LEFT_TIER.height, count: 6 },
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

/** Every training pad runs down the right-hand side of the plaza. */
export const TRAINING_ROW = {
  x: 11.5,
  startZ: 14,
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
  position: [0, 0, -31],
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
export const ARENA_ENTRANCE = {
  /** Half-width of the walkable corridor between the walls. */
  gapHalfWidth: 3.6,
  wallWidth: 10,
  wallHeight: 11,
  /** Walls run from the plaza end (near) to well past the stair top (far). */
  wallFromZ: -24,
  wallToZ: -38,
  /** Staircase. */
  stepCount: 10,
  stepRise: 0.62,
  stepRun: 1.45,
  stepFromZ: -26.5,
  /** Grass shoulder either side of the walls. */
  shoulderHeight: 2.2,
}

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
const ENTRANCE_WALL_RADIUS = 3
const ENTRANCE_WALL_OBSTACLES = (() => {
  const out = []
  const e = ARENA_ENTRANCE
  const centre = e.gapHalfWidth + ENTRANCE_WALL_RADIUS
  for (let z = e.wallFromZ; z >= PLAYER_BOUNDS.minZ - 3; z -= ENTRANCE_WALL_RADIUS) {
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
    trees.push({
      position: [
        side * (terrace.offset + (rand() - 0.5) * (terrace.width - 3)),
        0,
        PLAZA.from + 6 - t * (PLAZA.from - PLAZA.to + 22) - rand() * 4,
      ],
      terraceHeight: terrace.height,
      scale: 0.9 + rand() * 0.85,
      rotation: rand() * Math.PI,
    })
  }
  return trees
}

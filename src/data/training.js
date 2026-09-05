/**
 * Training pads.
 *
 * Standing on a pad trains your dino: it adds permanent Damage over time, at
 * the pad's multiplier. Better pads are gated behind rebirth counts, so the
 * rebirth loop is what opens up faster training rather than just a bigger
 * number - exactly the pull that keeps a hub game moving.
 *
 * All the tuning lives here.
 */

/** Damage per second earned on a x1 pad. */
export const TRAIN_BASE_RATE = 0.8

/** How often training is committed to the store, in seconds. */
export const TRAIN_FLUSH_INTERVAL = 0.25

/** How close to a pad's centre you must stand to be training on it. */
export const PAD_RADIUS = 2.1

/**
 * `deco` is the pad's own dressing - see `buildPadDecor` below.
 *
 * Nine pads that differed only in the colour of the same nine boxes read as
 * one pad printed nine times. The row is meant to be a ladder you can see
 * yourself climbing, so each rung has to look like somewhere further up than
 * the last.
 */
export const TRAINING_PADS = [
  { id: 'pad1', multiplier: 1, requiresRebirths: 0, color: '#e2e8f0', accent: '#94a3b8', deco: 'plain' },
  { id: 'pad2', multiplier: 2, requiresRebirths: 1, color: '#fde68a', accent: '#f59e0b', deco: 'ingots' },
  { id: 'pad3', multiplier: 3, requiresRebirths: 3, color: '#c4b5fd', accent: '#8b5cf6', deco: 'crystals' },
  { id: 'pad5', multiplier: 5, requiresRebirths: 6, color: '#a7f3d0', accent: '#10b981', deco: 'grove' },
  { id: 'pad8', multiplier: 8, requiresRebirths: 9, color: '#fca5a5', accent: '#ef4444', deco: 'lava' },
  { id: 'pad12', multiplier: 12, requiresRebirths: 12, color: '#93c5fd', accent: '#3b82f6', deco: 'ice' },
  { id: 'pad18', multiplier: 18, requiresRebirths: 15, color: '#f9a8d4', accent: '#ec4899', deco: 'hazard' },
  { id: 'pad26', multiplier: 26, requiresRebirths: 20, color: '#5eead4', accent: '#14b8a6', deco: 'orbs' },
  { id: 'pad40', multiplier: 40, requiresRebirths: 26, color: '#fdba74', accent: '#f97316', deco: 'flames' },
]

/** Half-width of the machine the dressing stands around. */
const PAD_HALF = 2.25

/** Deterministic per-pad jitter, so a pad looks the same on every load. */
function makeRandom(seed) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

/** The four corners of the machine, where most dressings hang their weight. */
const CORNERS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
]

/**
 * How far along the row one pad's dressing may reach, and how deep a single
 * piece of it may be.
 *
 * The row runs down Z with the pads under six metres apart, so a dressing has
 * well under three metres either side before it is standing on its neighbour -
 * while *across* the row it has the whole lawn. Two very different budgets on
 * the two axes, which is why the layouts below are written without regard for
 * either and squeezed to fit afterwards.
 */
const ROW_HALF = 2.6
const MAX_DEPTH = 0.55

/**
 * Squeeze a dressing into the space one pad owns.
 *
 * Along Z only: the depth of each piece is capped and then slid inside the
 * band between the standing circle and the pad's own edge. Anything wide
 * across the row is left alone, because there is room there.
 */
function fitToRow(items) {
  for (const item of items) {
    item.scale[2] = Math.min(item.scale[2], MAX_DEPTH)
    const limit = ROW_HALF - item.scale[2] / 2
    if (Math.abs(item.position[2]) > limit) {
      item.position[2] = Math.sign(item.position[2]) * limit
    }
    // A piece pushed onto the row's axis must not also be wide, or its corner
    // reaches back over the belt.
    if (Math.abs(item.position[0]) < PAD_HALF) {
      item.scale[0] = Math.min(item.scale[0], 1)
    }
  }
  return items
}

/**
 * What stands around one pad, as plain boxes.
 *
 * Returns `{ dull, lit }` - the machine's own dark blocks and the pieces that
 * glow in the pad's accent - so a whole dressing is two instanced draws
 * however many pieces it has. Everything sits outside `PAD_HALF`, because the
 * middle of a pad is where the dino stands.
 */
export function buildPadDecor(kind, seed = 0) {
  const rand = makeRandom(9001 + seed * 7717)
  const dull = []
  const lit = []

  const post = (into, x, z, width, height, spin = 0, tilt = 0) =>
    into.push({ position: [x, height / 2, z], scale: [width, height, width], rotation: spin, tilt })

  switch (kind) {
    case 'ingots':
      // Stacked bullion at each corner.
      for (const [sx, sz] of CORNERS) {
        const x = sx * PAD_HALF
        const z = sz * PAD_HALF
        for (let i = 0; i < 3; i++) {
          lit.push({
            position: [x + (rand() - 0.5) * 0.2, 0.16 + i * 0.22, z + (rand() - 0.5) * 0.2],
            scale: [0.8 - i * 0.14, 0.2, 0.5 - i * 0.08],
            rotation: rand() * 0.6,
          })
        }
      }
      break

    case 'crystals':
      // Shards leaning out of the ground.
      for (const [sx, sz] of CORNERS) {
        const count = 2 + Math.floor(rand() * 2)
        for (let i = 0; i < count; i++) {
          const height = 0.9 + rand() * 1.5
          lit.push({
            position: [
              sx * (PAD_HALF + rand() * 0.5),
              height / 2,
              sz * (PAD_HALF + rand() * 0.5),
            ],
            scale: [0.3 + rand() * 0.2, height, 0.3 + rand() * 0.2],
            rotation: rand() * Math.PI,
            tilt: (rand() - 0.5) * 0.5,
          })
        }
      }
      break

    case 'grove':
      // Planters at the corners with tufts growing out of them.
      for (const [sx, sz] of CORNERS) {
        post(dull, sx * PAD_HALF, sz * PAD_HALF, 1.1, 0.5)
        for (let i = 0; i < 3; i++) {
          const height = 0.5 + rand() * 0.7
          lit.push({
            position: [
              sx * PAD_HALF + (rand() - 0.5) * 0.7,
              0.5 + height / 2,
              sz * PAD_HALF + (rand() - 0.5) * 0.7,
            ],
            scale: [0.22, height, 0.22],
            rotation: rand() * Math.PI,
            tilt: (rand() - 0.5) * 0.4,
          })
        }
      }
      break

    case 'lava':
      // A cracked crust round the rim with the glow coming up through it.
      for (let i = 0; i < 16; i++) {
        const along = (i / 16) * Math.PI * 2
        const radius = PAD_HALF + 0.15 + rand() * 0.5
        const x = Math.cos(along) * radius
        const z = Math.sin(along) * radius
        post(dull, x, z, 0.6 + rand() * 0.5, 0.22 + rand() * 0.3, rand() * Math.PI)
        if (rand() < 0.55) {
          lit.push({
            position: [x, 0.05, z],
            scale: [0.9 + rand() * 0.6, 0.1, 0.2 + rand() * 0.2],
            rotation: rand() * Math.PI,
          })
        }
      }
      break

    case 'ice':
      // Spikes of every height around the rim.
      for (let i = 0; i < 14; i++) {
        const along = (i / 14) * Math.PI * 2
        const radius = PAD_HALF + 0.1 + rand() * 0.45
        const height = 0.5 + rand() * 1.8
        lit.push({
          position: [Math.cos(along) * radius, height / 2, Math.sin(along) * radius],
          scale: [0.26 + rand() * 0.2, height, 0.26 + rand() * 0.2],
          rotation: rand() * Math.PI,
          tilt: (rand() - 0.5) * 0.3,
        })
      }
      break

    case 'hazard':
      // Chevron kerbing down the two long sides.
      for (let i = 0; i < 7; i++) {
        const z = -PAD_HALF + (i / 6) * PAD_HALF * 2
        for (const sx of [-1, 1]) {
          const into = i % 2 === 0 ? lit : dull
          post(into, sx * (PAD_HALF + 0.25), z, 0.62, 0.34, 0.4 * sx)
        }
      }
      break

    case 'orbs':
      // Cubes hanging over the corners on thin stalks.
      for (const [sx, sz] of CORNERS) {
        post(dull, sx * PAD_HALF, sz * PAD_HALF, 0.18, 1.6)
        lit.push({
          position: [sx * PAD_HALF, 1.85 + rand() * 0.25, sz * PAD_HALF],
          scale: [0.5, 0.5, 0.5],
          rotation: rand() * Math.PI,
          tilt: 0.5,
        })
      }
      break

    case 'flames':
      // Braziers, each with a plume tapering off it.
      for (const [sx, sz] of CORNERS) {
        const x = sx * (PAD_HALF + 0.1)
        const z = sz * (PAD_HALF + 0.1)
        post(dull, x, z, 0.66, 0.85)
        for (let i = 0; i < 3; i++) {
          lit.push({
            position: [x + (rand() - 0.5) * 0.25, 1.05 + i * 0.45, z + (rand() - 0.5) * 0.25],
            scale: [0.52 - i * 0.13, 0.5, 0.52 - i * 0.13],
            rotation: rand() * Math.PI,
          })
        }
      }
      break

    default:
      break
  }

  return { dull: fitToRow(dull), lit: fitToRow(lit) }
}

/** Damage per second earned on a pad. */
export function padRate(pad) {
  return TRAIN_BASE_RATE * pad.multiplier
}

/** Whether the player's rebirth count opens this pad. */
export function padUnlocked(pad, rebirths) {
  return rebirths >= pad.requiresRebirths
}

/** Best pad the player can currently use, for the HUD hint. */
export function bestUnlockedPad(rebirths) {
  let best = TRAINING_PADS[0]
  for (const pad of TRAINING_PADS) {
    if (padUnlocked(pad, rebirths)) best = pad
  }
  return best
}

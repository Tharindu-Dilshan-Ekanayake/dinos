import { areaForStage } from './areas.js'

/**
 * Per-stage weather and sky mood.
 *
 * A biome sets the palette; this sets what the *air* is doing, and it changes
 * from one level to the next. Walking through a jungle where stage 3 is a
 * downpour, stage 4 is drifting leaves and stage 5 is clear sunshine makes a
 * corridor of chambers feel like a journey rather than the same room repainted.
 *
 * Everything is deterministic from the stage index, so a given level always
 * has the same weather - two players comparing stage 7 see the same storm.
 */

/**
 * How each kind of weather looks and how it leans on the light.
 *
 * `size` is the particle's box in world units; `rising` sends it up from the
 * ground instead of down from the sky; `glow` draws it additively so embers and
 * spores burn rather than sit flat. `fogPull` tightens the fog and `darken`
 * pulls the sky and key light down - that pair is what makes a storm feel
 * heavy instead of just adding streaks to a bright day.
 */
export const WEATHER_TYPES = {
  clear: { count: 0, cloudBoost: 0, fogPull: 0, darken: 0 },

  rain: {
    count: 300,
    size: [0.07, 1, 0.07],
    color: '#bcdfff',
    speed: 22,
    drift: 0.5,
    tilt: 0.12,
    opacity: 0.62,
    cloudBoost: 8,
    fogPull: 0.2,
    darken: 0.16,
  },
  storm: {
    count: 470,
    size: [0.08, 1.3, 0.08],
    color: '#b4d6ff',
    speed: 30,
    drift: 1.1,
    tilt: 0.26,
    opacity: 0.7,
    cloudBoost: 16,
    fogPull: 0.34,
    darken: 0.3,
  },
  leaves: {
    count: 90,
    size: [0.24, 0.07, 0.19],
    color: '#8fd44a',
    speed: 2.1,
    drift: 2.6,
    spin: 1.8,
    opacity: 1,
    cloudBoost: 0,
    fogPull: 0,
    darken: 0,
  },
  snow: {
    count: 280,
    size: [0.1, 0.1, 0.1],
    color: '#ffffff',
    speed: 2.4,
    drift: 1.3,
    opacity: 0.95,
    cloudBoost: 6,
    fogPull: 0.18,
    darken: 0.04,
  },
  blizzard: {
    count: 500,
    size: [0.1, 0.1, 0.1],
    color: '#f2fbff',
    speed: 7,
    drift: 3.6,
    tilt: 0.2,
    opacity: 0.95,
    cloudBoost: 12,
    fogPull: 0.44,
    darken: 0.1,
  },
  embers: {
    count: 150,
    size: [0.11, 0.11, 0.11],
    color: '#ff8a2b',
    speed: 3,
    drift: 1.5,
    rising: true,
    glow: true,
    opacity: 0.9,
    cloudBoost: 0,
    fogPull: 0,
    darken: 0,
  },
  ash: {
    count: 250,
    size: [0.1, 0.1, 0.1],
    color: '#7b7880',
    speed: 1.7,
    drift: 1.8,
    spin: 0.9,
    opacity: 0.8,
    cloudBoost: 10,
    fogPull: 0.3,
    darken: 0.14,
  },
  spores: {
    count: 170,
    size: [0.15, 0.15, 0.15],
    color: '#c9ff4f',
    speed: 1.3,
    drift: 1.5,
    rising: true,
    glow: true,
    opacity: 0.75,
    cloudBoost: 0,
    fogPull: 0.12,
    darken: 0,
  },
  motes: {
    count: 210,
    size: [0.13, 0.13, 0.13],
    color: '#d9c4ff',
    speed: 0.8,
    drift: 1.1,
    rising: true,
    glow: true,
    opacity: 0.8,
    cloudBoost: 0,
    fogPull: 0,
    darken: 0,
  },
}

/**
 * The weather a biome cycles through.
 *
 * Rotations are deliberately not the same length as each other or as the
 * mood rota below, so weather and sky drift out of step and the combinations
 * keep changing as you climb.
 */
const ROTATIONS = {
  jungle: ['clear', 'leaves', 'rain', 'clear', 'storm', 'leaves', 'rain'],
  volcano: ['embers', 'ash', 'embers', 'ash', 'storm'],
  ice: ['snow', 'clear', 'blizzard', 'snow'],
  marsh: ['spores', 'rain', 'spores', 'storm', 'clear', 'spores'],
  cosmic: ['motes', 'clear', 'motes', 'storm'],
}

/** The weather for a 0-indexed stage. */
export function weatherForStage(stageIndex) {
  const area = areaForStage(stageIndex)
  const rotation = ROTATIONS[area.id] ?? ROTATIONS.jungle
  const key = rotation[stageIndex % rotation.length]
  return { key, ...WEATHER_TYPES[key] }
}

/**
 * Time of day, roughly.
 *
 * `warmth` swings the sky toward sunset orange, `darken` toward dusk, and the
 * cloud and ridge settings change what the horizon is made of - so two stages
 * with the same weather still do not look like the same place.
 *
 * `sun` is where the sun hangs and how big it burns: `elevation` runs 0 at the
 * horizon to 1 overhead. A low sun is a large one, the way it reads at dusk.
 */
const MOODS = [
  {
    id: 'noon',
    warmth: 0,
    darken: 0,
    clouds: 11,
    cloudHeight: 34,
    ridge: 0.85,
    sun: { elevation: 0.78, size: 2.8, color: '#fff4c9' },
  },
  {
    id: 'golden',
    warmth: 0.32,
    darken: 0.05,
    clouds: 8,
    cloudHeight: 29,
    ridge: 1.15,
    sun: { elevation: 0.2, size: 4.5, color: '#ffb04d' },
  },
  {
    id: 'overcast',
    warmth: -0.1,
    darken: 0.16,
    clouds: 22,
    cloudHeight: 25,
    ridge: 0.6,
    // Behind the weather: still there, barely burning through.
    sun: { elevation: 0.6, size: 3, color: '#e6edf5' },
  },
  {
    id: 'dusk',
    warmth: 0.2,
    darken: 0.24,
    clouds: 13,
    cloudHeight: 31,
    ridge: 1.35,
    sun: { elevation: 0.1, size: 5.2, color: '#ff8a3d' },
  },
  {
    id: 'high',
    warmth: 0.05,
    darken: 0,
    clouds: 6,
    cloudHeight: 38,
    ridge: 1,
    sun: { elevation: 0.9, size: 2.4, color: '#fffbe8' },
  },
]

/** The sky mood for a 0-indexed stage. */
export function skyMoodForStage(stageIndex) {
  return MOODS[(stageIndex * 3 + 1) % MOODS.length]
}

/**
 * What each biome's horizon is made of.
 *
 * `taper` is the top width as a fraction of the base: 1 is a box, so hills and
 * mounds stack as blocks, while volcanoes, ice peaks and rift shards are
 * four-sided cones. `spread` is the width-to-height range - a hill is broad
 * and a shard is not. `steps` is how many blocks a peak stacks: a cone is one,
 * a hill is two or three.
 */
export const RIDGE_STYLES = {
  /** Rolling forested hills, capped in dark canopy. */
  hills: { taper: 1, height: [9, 20], spread: [1.5, 2.6], steps: [2, 3], cap: 0.2 },
  /** Cones with a lava-filled crater burning at the top. */
  volcano: { taper: 0.3, height: [15, 30], spread: [1.1, 1.7], steps: [1, 1], cap: 0.1 },
  /** Sharp ice mountains under snow caps. */
  peaks: { taper: 0.1, height: [16, 32], spread: [0.85, 1.35], steps: [1, 2], cap: 0.3 },
  /** Low swollen marsh mounds. */
  mounds: { taper: 1, height: [6, 13], spread: [1.9, 3.2], steps: [2, 2], cap: 0.16 },
  /** Rift crystal, leaning off vertical and glowing at the tip. */
  shards: { taper: 0.14, height: [14, 30], spread: [0.5, 0.95], steps: [1, 1], cap: 0.32, lean: 0.22 },
}

/**
 * The blocky mountain skyline behind the chamber walls.
 *
 * Seeded from the stage, so every level looks out on a different horizon, and
 * shaped by the biome, so a jungle looks out on forested hills and a caldera on
 * a ring of smoking volcanoes. Returns the peaks and their caps separately -
 * caps are drawn with their own colour, which is what puts snow on the ice
 * mountains and lava in the volcanoes.
 */
export function buildRidge(stageIndex, mood, style, radius = 88, count = 26) {
  const spec = RIDGE_STYLES[style] ?? RIDGE_STYLES.hills

  let seed = ((stageIndex + 1) * 2654435761) % 4294967296
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  const base = []
  const caps = []

  for (let i = 0; i < count; i++) {
    const angle = ((i + rand() * 0.55) / count) * Math.PI * 2
    const distance = radius * (0.85 + rand() * 0.3)
    const x = Math.cos(angle) * distance
    const z = Math.sin(angle) * distance

    const height =
      (spec.height[0] + rand() * (spec.height[1] - spec.height[0])) * mood.ridge
    const width = height * (spec.spread[0] + rand() * (spec.spread[1] - spec.spread[0]))
    const steps = spec.steps[0] + Math.floor(rand() * (spec.steps[1] - spec.steps[0] + 1))
    const spin = rand() * Math.PI
    const lean = spec.lean ? (rand() - 0.5) * spec.lean : 0

    // Concentric stacked blocks for the box styles; a single cone otherwise.
    for (let step = 0; step < steps; step++) {
      const t = step / steps
      const h = height * (1 - t * 0.55)
      base.push({
        position: [x, h / 2, z],
        scale: [width * (1 - t * 0.4), h, width * (1 - t * 0.4)],
        rotation: spin,
        tilt: lean,
        roll: lean,
      })
    }

    const capHeight = height * spec.cap
    caps.push({
      position: [x, height - capHeight / 2, z],
      // Sized to the peak's summit, plus a little, so it sits on top rather
      // than being swallowed by it.
      scale: [
        width * (spec.taper + 0.16),
        capHeight,
        width * (spec.taper + 0.16),
      ],
      rotation: spin,
      tilt: lean,
      roll: lean,
    })
  }

  return { base, caps, taper: spec.taper }
}

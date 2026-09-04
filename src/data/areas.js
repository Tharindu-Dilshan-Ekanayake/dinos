/**
 * Areas group stages into themed worlds.
 *
 * Each area owns the whole look of the battle arena: sky gradient, fog, the
 * checkered floor, the terraced cliff walls that enclose the fight, which prop
 * is scattered around the rim, and whether glowing veins (lava, crystal) run
 * through the ground. Crossing a boundary lerps every colour over
 * AREA_TRANSITION_SECONDS, so the world melts from one biome into the next.
 *
 * `fromStage` / `toStage` are 1-indexed and inclusive, matching the labels the
 * player sees in the HUD.
 */
export const AREA_TRANSITION_SECONDS = 1.4

export const AREAS = [
  {
    id: 'jungle',
    name: 'Jungle Hollow',
    fromStage: 1,
    toStage: 15,
    // Sky + atmosphere
    skyTop: '#2f7fd4',
    skyBottom: '#bde9ff',
    fog: '#a9dcc0',
    fogNear: 34,
    fogFar: 96,
    // Voxel arena floor: checker tones, its edge ring, and its grass blades
    floorA: '#79d152',
    floorB: '#5cb63c',
    floorEdge: '#3f8f2c',
    tuft: '#a6e75c',
    flower: '#ffd93d',
    // Terraced cliffs enclosing the arena
    cliff: '#b08968',
    cliffTop: '#79c94f',
    cliffDark: '#8c6a4f',
    // The skyline this biome looks out on, and the rim scatter
    ridge: 'hills',
    ridgeCap: '#3f8f2c',
    prop: 'tree',
    propColor: '#4faa39',
    propAccent: '#8a5a3b',
    // Glowing ground veins - off in a jungle
    glow: '#7cf7a0',
    glowStrength: 0,
    // Lighting
    key: '#fff6e0',
    ambient: '#cfe8ff',
    // Enemy tint for this biome
    enemy: '#c86bd6',
    enemyAccent: '#f2c1ff',
  },
  {
    id: 'volcano',
    name: 'Ember Caldera',
    fromStage: 16,
    toStage: 30,
    skyTop: '#3a1220',
    skyBottom: '#ff9d4d',
    fog: '#8a3a24',
    fogNear: 28,
    fogFar: 84,
    floorA: '#4a4a55',
    floorB: '#37373f',
    floorEdge: '#25252b',
    tuft: '#7d4230',
    flower: null,
    cliff: '#6b4a52',
    cliffTop: '#4a2f3a',
    cliffDark: '#432c33',
    ridge: 'volcano',
    ridgeCap: '#ff7a18',
    prop: 'rock',
    propColor: '#57575f',
    propAccent: '#8c3a1f',
    glow: '#ff7a18',
    glowStrength: 1,
    key: '#ffd7a8',
    ambient: '#ff9a63',
    enemy: '#3fd0c9',
    enemyAccent: '#c4fffb',
  },
  {
    id: 'ice',
    name: 'Frost Hollow',
    fromStage: 31,
    toStage: 45,
    skyTop: '#1b4a86',
    skyBottom: '#d6f4ff',
    fog: '#b9e4f5',
    fogNear: 32,
    fogFar: 92,
    floorA: '#dff2ff',
    floorB: '#b6ddf2',
    floorEdge: '#8ec4e0',
    tuft: '#eaf9ff',
    flower: '#bfe9ff',
    cliff: '#9fd0ea',
    cliffTop: '#f2fbff',
    cliffDark: '#7aaecd',
    ridge: 'peaks',
    ridgeCap: '#ffffff',
    prop: 'crystal',
    propColor: '#a9e6ff',
    propAccent: '#ffffff',
    glow: '#8fe4ff',
    glowStrength: 0.55,
    key: '#eaf7ff',
    ambient: '#bfe4ff',
    enemy: '#ff8a5c',
    enemyAccent: '#ffd9c4',
  },
  {
    id: 'marsh',
    name: 'Toxic Marsh',
    fromStage: 46,
    toStage: 60,
    skyTop: '#1e2f1a',
    skyBottom: '#a8d84f',
    fog: '#6f9440',
    fogNear: 26,
    fogFar: 78,
    floorA: '#5d7a3a',
    floorB: '#48602c',
    floorEdge: '#334621',
    tuft: '#9ac93f',
    flower: '#d98cff',
    cliff: '#5a5a3a',
    cliffTop: '#7fa83f',
    cliffDark: '#42422a',
    ridge: 'mounds',
    ridgeCap: '#7fa83f',
    prop: 'mushroom',
    propColor: '#8e4fd1',
    propAccent: '#c9ff4f',
    glow: '#b6ff2e',
    glowStrength: 0.85,
    key: '#eaffc4',
    ambient: '#a8d84f',
    enemy: '#ff5d8f',
    enemyAccent: '#ffd0e0',
  },
  {
    id: 'cosmic',
    name: 'Cosmic Rift',
    fromStage: 61,
    toStage: 75,
    skyTop: '#0a0620',
    skyBottom: '#6c3fd6',
    fog: '#3b2470',
    fogNear: 30,
    fogFar: 88,
    floorA: '#3b2f70',
    floorB: '#2b2154',
    floorEdge: '#1b1440',
    tuft: '#8f79ea',
    flower: '#ffe066',
    cliff: '#413178',
    cliffTop: '#7b5be0',
    cliffDark: '#2c2154',
    ridge: 'shards',
    ridgeCap: '#c9a3ff',
    prop: 'crystal',
    propColor: '#b39dff',
    propAccent: '#ffe066',
    glow: '#c9a3ff',
    glowStrength: 1,
    key: '#e5d9ff',
    ambient: '#9d86ff',
    enemy: '#ffd166',
    enemyAccent: '#fff3c4',
  },
]

/** Area containing a 0-indexed stage (clamped to the last area). */
export function areaForStage(stageIndex) {
  const stage = stageIndex + 1
  return (
    AREAS.find((a) => stage >= a.fromStage && stage <= a.toStage) ?? AREAS[AREAS.length - 1]
  )
}

/** Index of the area containing a 0-indexed stage. */
export function areaIndexForStage(stageIndex) {
  const area = areaForStage(stageIndex)
  return AREAS.indexOf(area)
}

/** 0-1 progress through the current area, for the HUD progress bar. */
export function areaProgress(stageIndex) {
  const area = areaForStage(stageIndex)
  const span = area.toStage - area.fromStage + 1
  const done = stageIndex + 1 - area.fromStage
  return Math.min(1, Math.max(0, done / span))
}

/* --------------------------------------------------- per-level variation */

/**
 * Every level gets its own palette.
 *
 * The biome sets the theme; this shifts it a little further with each level
 * inside that biome, so Stage 6 is recognisably the same jungle as Stage 5 but
 * visibly not the same room. Without it a player walking a corridor of
 * chambers would think they were going in circles.
 *
 * The shift is deterministic from the stage index - no randomness - so a given
 * level always looks the same.
 */
const HUE_SWING = 0.05
const LIGHT_SWING = 0.09

/** Small signed offset in [-1, 1] that varies with the stage but never drifts. */
function wobble(stageIndex, salt) {
  const v = Math.sin((stageIndex + 1) * salt) * 43758.5453
  return (v - Math.floor(v)) * 2 - 1
}

function shift(hex, hue, light) {
  // Parse and nudge in HSL space; three.js Color does the same conversion, but
  // doing it here keeps the data layer free of a THREE import.
  const n = parseInt(hex.slice(1), 16)
  let r = ((n >> 16) & 255) / 255
  let g = ((n >> 8) & 255) / 255
  let b = (n & 255) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let l = (max + min) / 2
  const d = max - min
  let sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))

  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
    if (h < 0) h += 1
  }

  h = (h + hue + 1) % 1
  l = Math.min(0.94, Math.max(0.06, l + light))

  const c = (1 - Math.abs(2 * l - 1)) * sat
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1))
  const m = l - c / 2
  const seg = Math.floor(h * 6) % 6
  const table = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][seg]

  r = Math.round((table[0] + m) * 255)
  g = Math.round((table[1] + m) * 255)
  b = Math.round((table[2] + m) * 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/**
 * A lighter (`light > 0`) or darker shade of a palette colour.
 *
 * The ground dressing needs two tones of the same green; deriving them keeps
 * every biome - including the per-level shifted ones - in step automatically.
 */
export function shadeColor(hex, light) {
  return shift(hex, 0, light)
}

/** Colours that carry the biome's identity and so shift only slightly. */
const SHIFTED_KEYS = [
  'skyTop',
  'skyBottom',
  'fog',
  'floorA',
  'floorB',
  'floorEdge',
  'cliff',
  'cliffTop',
  'cliffDark',
  'propColor',
  'propAccent',
  'tuft',
  'glow',
  'ambient',
]

/** The palette a specific level is drawn with. */
export function paletteForStage(stageIndex) {
  const area = areaForStage(stageIndex)
  const hue = wobble(stageIndex, 12.9898) * HUE_SWING
  const light = wobble(stageIndex, 78.233) * LIGHT_SWING

  const out = { ...area }
  for (const key of SHIFTED_KEYS) {
    if (typeof area[key] === 'string') out[key] = shift(area[key], hue, light)
  }
  return out
}

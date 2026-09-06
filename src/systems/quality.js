/**
 * How hard this machine should be asked to work.
 *
 * Measured on the real thing (`npm run budget`), a frame of the hub submits
 * around 2,900 draw calls and 265,000 triangles - a third of the calls and a
 * third of the triangles being the shadow pass alone. That is comfortable on a
 * discrete GPU and miserable on integrated graphics, where the draw-call count
 * is the wall you hit first: the CPU cannot feed the GPU fast enough and the
 * frame rate falls off a cliff no amount of resolution-lowering recovers.
 *
 * So the knobs here are ordered by what they actually buy:
 *
 *   `shadows`  - the whole second pass. The single biggest saving there is.
 *   `dpr`      - pixels, which is what fill-limited machines choke on.
 *   `antialias`- a whole extra resolve per frame for a game made of hard edges.
 *   `detail`   - how much decoration is worth building at all.
 *
 * Nothing here changes the game, and nothing here makes anything *vanish*:
 * every level, prop and podium is in the same place, drawn, at every setting.
 * Scenery that disappears on a lower setting is a worse game rather than a
 * faster one - so the work of making the hub cheap is done by merging boxes
 * that were always going to be drawn together (see MergedBoxes), not by
 * deciding you cannot see them.
 */

/** The presets, weakest first. `id` is what gets saved. */
export const QUALITY_LEVELS = [
  {
    id: 'low',
    name: 'Low',
    blurb: 'No shadows, lighter scenery - for older laptops and phones',
    dpr: [0.75, 1],
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    detail: 0.5,
  },
  {
    id: 'medium',
    name: 'Medium',
    blurb: 'Soft shadows at a lower resolution',
    dpr: [1, 1.25],
    antialias: false,
    shadows: true,
    shadowMapSize: 512,
    detail: 0.8,
  },
  {
    id: 'high',
    name: 'High',
    blurb: 'Everything on',
    dpr: [1, 1.75],
    antialias: true,
    shadows: true,
    shadowMapSize: 1024,
    detail: 1,
  },
]

const BY_ID = new Map(QUALITY_LEVELS.map((level) => [level.id, level]))

/**
 * What this machine looks like it can take.
 *
 * Nothing here is a measurement - the browser will not tell you what GPU it is
 * driving, and a timing probe on the first frame measures compilation rather
 * than rendering. These are the two numbers that correlate at all, read
 * conservatively: a machine that under-reports gets a duller game, and a
 * machine that gets it wrong is one settings menu away from saying so.
 */
export function detectQuality() {
  if (typeof navigator === 'undefined') return 'high'

  const cores = navigator.hardwareConcurrency ?? 4
  // Chrome-only, and coarse (capped at 8), but when it is there it is the best
  // signal available.
  const memory = navigator.deviceMemory ?? 8
  const touch = navigator.maxTouchPoints > 0

  if (cores <= 4 || memory <= 4) return 'low'
  if (cores <= 8 || memory <= 6 || touch) return 'medium'
  return 'high'
}

/** Resolve a saved choice - including 'auto' - to a preset. */
export function qualitySettings(choice) {
  if (choice === 'auto' || !BY_ID.has(choice)) return BY_ID.get(detectQuality())
  return BY_ID.get(choice)
}

/**
 * Scale a decoration count by the detail budget.
 *
 * Always leaves at least one of anything that existed, because a scatter that
 * empties out entirely reads as a bug rather than as a lower setting.
 */
export function detailCount(count, detail) {
  if (count <= 0) return 0
  return Math.max(1, Math.round(count * detail))
}

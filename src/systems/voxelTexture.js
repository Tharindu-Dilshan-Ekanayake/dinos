import * as THREE from 'three'

/**
 * Procedural voxel surface textures.
 *
 * The whole game reads as stacked blocks, and flat-coloured boxes alone look
 * like untextured primitives rather than carved terrain. Painting a grid of
 * slightly mis-matched squares - plus the odd darker fleck - into a canvas gives
 * every face the hand-placed-blocks look without a single asset download, and
 * NEAREST magnification keeps the cells hard-edged however close the camera
 * gets.
 *
 * Four patterns, one for each kind of surface the game has: `cells` for loose
 * rock, `studs` for moulded ground and terrain blocks, `bricks` for built walls
 * and steps, `tiles` for paving.
 *
 * Textures are cached and shared: a chamber's four surfaces are three meshes
 * apiece across three mounted chambers, and rebuilding a canvas for each would
 * hitch the frame every time the player crossed a level boundary.
 */

/** Canvas edge. Power of two so mipmaps (and therefore no shimmer) work. */
const TEXTURE_SIZE = 128

/**
 * Cache bound. Palettes shift per level, so a long run would otherwise stack up
 * one texture set per stage; the least recently used entry is evicted instead.
 * A disposed texture that is somehow still on screen re-uploads on next draw,
 * so eviction can never corrupt a frame - it only costs an upload.
 */
const CACHE_LIMIT = 96

const cache = new Map()

/**
 * How much of the grubbiness a caller asks for actually gets painted.
 *
 * Every surface in the game was individually reasonable and the world they
 * added up to was not: cell-to-cell colour jitter on the grass, flecks in the
 * soil, chips in the rock, all of it at full strength on every face at once.
 * Nothing was dirty on its own; everything was slightly dirty together, which
 * is what made a bright toy world read as muddy.
 *
 * Damping it in one place rather than at ninety call sites keeps the *ratios*
 * every surface was tuned with - rock is still rougher than paving - and turns
 * "how worn is this world" into one number you can move. 1 is the old look;
 * lower is cleaner.
 */
const GRIT = 0.4

/** Deterministic LCG - the same colour always paints the same texture. */
function makeRandom(seed) {
  let state = seed % 4294967296
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function parseHex(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Mixes a colour toward white (amount > 0) or black (amount < 0). */
function tone(rgb, amount) {
  const target = amount > 0 ? 255 : 0
  const k = Math.abs(amount)
  const c = rgb.map((v) => Math.round(v + (target - v) * k))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

/** Loose ground: jittered cells with the odd darker chip. */
function paintCells(ctx, rgb, rand, { cells, variance, fleck, fleckDepth }) {
  const step = TEXTURE_SIZE / cells

  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      // Per-cell tone jitter: this is what stops a face reading as flat paint.
      ctx.fillStyle = tone(rgb, (rand() - 0.5) * 2 * variance)
      ctx.fillRect(x * step, y * step, step, step)

      // A darker chip inside some cells - pebbles in dirt, tufts in grass.
      if (rand() < fleck) {
        const size = step * 0.375
        ctx.fillStyle = tone(rgb, -fleckDepth)
        ctx.fillRect(
          x * step + Math.floor(rand() * 3) * size,
          y * step + Math.floor(rand() * 3) * size,
          size,
          size
        )
      }
    }
  }
}

/**
 * Built stone: courses of offset blocks with mortar between them.
 *
 * A wall wants to look *stacked*, not eroded, so the same jitter is applied
 * per brick rather than per cell and every brick is outlined.
 */
function paintBricks(ctx, rgb, rand, { cells, variance, fleckDepth }) {
  const rows = cells
  const rowHeight = TEXTURE_SIZE / rows
  const brickWidth = TEXTURE_SIZE / Math.max(2, Math.round(cells / 2))

  ctx.fillStyle = tone(rgb, -fleckDepth * 1.2)
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)

  const mortar = Math.max(1, Math.round(rowHeight * 0.12))

  for (let row = 0; row < rows; row++) {
    // Every other course is shifted half a brick, the way stone is laid.
    const offset = row % 2 === 0 ? 0 : -brickWidth / 2
    for (let x = offset; x < TEXTURE_SIZE; x += brickWidth) {
      ctx.fillStyle = tone(rgb, (rand() - 0.5) * 2 * variance)
      ctx.fillRect(
        x + mortar,
        row * rowHeight + mortar,
        brickWidth - mortar * 2,
        rowHeight - mortar * 2
      )
    }
  }
}

/**
 * Paving: a checker of two tones, each tile nudged a little off its neighbour.
 *
 * A flat two-colour checker is the one surface in the hub that still looks
 * printed rather than built; the jitter and the grout give it the same
 * hand-laid feel as everything around it.
 */
function paintTiles(ctx, rgb, rand, { cells, variance, fleckDepth, accent }) {
  const step = TEXTURE_SIZE / cells
  const accentRgb = accent ? parseHex(accent) : rgb.map((v) => Math.round(v * 0.88))

  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const base = (x + y) % 2 === 0 ? rgb : accentRgb
      ctx.fillStyle = tone(base, (rand() - 0.5) * 2 * variance)
      ctx.fillRect(x * step, y * step, step, step)

      // Grout: drawn as inset edges rather than strokes so it stays crisp
      // under NEAREST magnification.
      const grout = Math.max(1, Math.round(step * 0.06))
      ctx.fillStyle = tone(base, -fleckDepth)
      ctx.fillRect(x * step, y * step, step, grout)
      ctx.fillRect(x * step, y * step, grout, step)
    }
  }
}

/**
 * Moulded plastic bricks: a regular grid of raised studs.
 *
 * The other patterns scatter their detail; this one does not, because the look
 * it is copying is manufactured. Every stud sits dead centre in its cell with a
 * lit top-left edge and a shaded bottom-right one, which is all it takes for a
 * flat texture to read as a surface with bumps on it.
 */
function paintStuds(ctx, rgb, rand, { cells, variance, fleckDepth, accent }) {
  const step = TEXTURE_SIZE / cells
  const radius = step * 0.235
  // How far the shadow and the highlight slide off centre. Small: a stud is a
  // few millimetres proud of the brick, not a ball sitting on it.
  const lift = Math.max(0.7, radius * 0.2)
  // With an accent the studs sit on a checker, which is how paving reads in
  // this kind of game: two tones of slab, every one of them moulded.
  const accentRgb = accent ? parseHex(accent) : null

  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const base = accentRgb && (x + y) % 2 === 1 ? accentRgb : rgb

      // A whisper of jitter per tile stops a large surface banding.
      ctx.fillStyle = tone(base, (rand() - 0.5) * 2 * variance * 0.5)
      ctx.fillRect(x * step, y * step, step, step)

      const cx = x * step + step / 2
      const cy = y * step + step / 2

      const disc = (shade, ox, oy, r) => {
        ctx.fillStyle = tone(base, shade)
        ctx.beginPath()
        ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2)
        ctx.fill()
      }

      /*
       * A stud is a cylinder, so it is drawn as one: three discs.
       *
       * They were squares - a dark square, a lighter square inside it and two
       * bright strips along its top and left - which at a distance is a grid of
       * pixels and at close range is a tiled floor with squares printed on it.
       * The whole read of this material is *moulded plastic*, and the one shape
       * plastic is moulded into here is round. The shadow slips down, the
       * highlight slips up and left, and between them the flat texture has a
       * bump on it.
       */
      disc(-fleckDepth, 0, lift, radius)
      disc(-fleckDepth * 0.3, 0, 0, radius)
      disc(fleckDepth * 0.55, -lift * 0.5, -lift * 0.7, radius * 0.76)
    }
  }
}

const PAINTERS = {
  cells: paintCells,
  bricks: paintBricks,
  tiles: paintTiles,
  studs: paintStuds,
}

function paint(color, options) {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const ctx = canvas.getContext('2d')

  const rgb = parseHex(color)
  const rand = makeRandom(options.seed)

  ctx.fillStyle = tone(rgb, 0)
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
  /*
   * The three knobs that make a surface look worn, all scaled together - so a
   * painter still gets the shape it was written for (studs, courses, checker),
   * just with less dirt rubbed into it. `cells` is deliberately untouched: it
   * is the moulding, not the grime.
   */
  ;(PAINTERS[options.pattern] ?? paintCells)(ctx, rgb, rand, {
    ...options,
    variance: options.variance * GRIT,
    fleck: options.fleck * GRIT,
    fleckDepth: options.fleckDepth * GRIT,
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  // Hard cells up close, mipmapped in the distance so the corridor does not
  // sparkle as the camera moves.
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 4
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * A cached voxel texture for `color`.
 *
 * `repeat` is baked into the cache key rather than applied by the caller,
 * because a THREE.Texture owns its repeat: two meshes sharing one texture
 * cannot tile it at different rates.
 */
export function voxelTexture(color, options = {}) {
  const {
    pattern = 'cells',
    cells = 8,
    variance = 0.08,
    fleck = 0.22,
    fleckDepth = 0.2,
    accent = null,
    repeat = 1,
    seed = 1337,
  } = options

  const [repeatX, repeatY] = Array.isArray(repeat) ? repeat : [repeat, repeat]
  const key = `${pattern}|${color}|${accent}|${cells}|${variance}|${fleck}|${fleckDepth}|${repeatX}x${repeatY}|${seed}`

  const hit = cache.get(key)
  if (hit) {
    // Re-insert so the map stays ordered least-recently-used first.
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }

  const texture = paint(color, { pattern, cells, variance, fleck, fleckDepth, accent, seed })
  texture.repeat.set(repeatX, repeatY)

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    cache.get(oldest)?.dispose()
    cache.delete(oldest)
  }
  cache.set(key, texture)
  return texture
}

/**
 * A neutral map for surfaces whose colour is set at runtime.
 *
 * `voxelMaterial` bakes the colour into the canvas, which is wrong for
 * anything tinted from a live palette - the arena's rim props hold their
 * THREE.Color by reference so a biome can lerp them. This paints the pattern
 * in white instead, and since a map multiplies against `material.color`, the
 * studs come out in whatever colour the caller is flying that frame.
 */
export function voxelTintMap(options = {}) {
  return voxelTexture('#ffffff', options)
}

/**
 * A flat-shaded standard material wearing a voxel texture.
 *
 * The colour is baked into the texture, so the material's own colour stays
 * white; callers dispose the material, never the map, which the cache owns.
 */
export function voxelMaterial(color, options = {}) {
  const {
    roughness = 0.95,
    flatShading = true,
    /*
     * A surface painted onto another surface. Passed straight through to the
     * material as a polygon offset - see systems/decal.js for why a centimetre
     * of physical separation is not enough on its own.
     */
    decal,
    ...textureOptions
  } = options
  return new THREE.MeshStandardMaterial({
    map: voxelTexture(color, textureOptions),
    roughness,
    metalness: 0,
    flatShading,
    ...(decal ?? {}),
  })
}

/**
 * Tree shapes, described as blocks.
 *
 * Both the hub's terraces and the arena's rim grow the same trees, so the
 * description lives here rather than being written twice.
 *
 * A canopy is a handful of *big slabs*, not a cluster of small cubes. Small
 * cubes with a jitter on them average into a sphere the moment the camera is
 * more than a few metres away, and a green sphere belongs to a different game;
 * four broad plates keep their corners and their hard shadow steps at any
 * distance. It costs nothing extra to draw because the blocks are merged into
 * one geometry per material before they are instanced.
 *
 * `material` keys are 'trunk', 'leaf' (the shaded bulk) and 'leafLight' (the
 * lit crown), so a caller can tint the three however its scene wants.
 */

const box = (material, position, size, rotation) => ({ material, position, size, rotation })

/**
 * One chunky conifer.
 *
 * `scale` stretches the whole thing; `seed` shuffles which blocks are nudged,
 * so a row of trees is not a row of clones.
 */
export function treeBoxes({ scale = 1, seed = 1 } = {}) {
  let state = seed * 2654435761 % 4294967296
  const rand = () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
  /** A small shove, so no two blocks in the cluster line up perfectly. */
  const jitter = (amount) => (rand() - 0.5) * amount

  const s = (v) => v * scale

  /*
   * Trunk: a bare tapering post, three segments, no canopy anywhere near it.
   *
   * It used to be a stub two thirds buried in leaves, because the canopy began
   * at two and a half and the trunk stopped at two. What that grows is a bush
   * on a peg. In the reference the trunk is the tallest part of the tree and
   * you can see all of it - which is what makes a row of them read as trees
   * from across the plaza rather than as green blobs at ankle height.
   */
  const out = [
    box('trunk', [0, s(0.5), 0], [s(0.62), s(1.0), s(0.62)]),
    box('trunk', [0, s(1.45), 0], [s(0.5), s(0.95), s(0.5)]),
    box('trunk', [0, s(2.35), 0], [s(0.4), s(0.9), s(0.4)]),
  ]

  /*
   * Canopy: four big slabs leaning on each other, not a cone of small cubes.
   *
   * Fourteen jittered cubes average out into a sphere at any distance, and a
   * green sphere is the one shape this art style never uses. Four broad plates
   * at four angles keep their corners: you read the silhouette as flat pieces
   * stacked, the shadows fall in hard steps down the side of it, and the whole
   * tree is six boxes rather than seventeen.
   */
  const slab = (material, x, y, z, w, h, d, turn) =>
    out.push(
      box(
        material,
        [s(x + jitter(0.14)), s(y + jitter(0.1)), s(z + jitter(0.14))],
        [s(w), s(h), s(d)],
        [0, turn, 0]
      )
    )

  slab('leaf', 0, 3.05, 0, 2.4, 0.95, 2.15, 0.18)
  slab('leaf', -0.72, 3.45, 0.42, 1.55, 0.9, 1.45, 0.72)
  slab('leafLight', 0.78, 3.6, -0.38, 1.7, 1.0, 1.55, -0.42)
  slab('leafLight', 0.05, 4.1, 0.08, 1.55, 0.95, 1.45, 0.34)

  return out
}

/** Half-width of a tree's widest slab at scale 1, for keeping it off ledges. */
export const TREE_HALF_WIDTH = 1.9

/**
 * The hub's trees: three shapes instead of one.
 *
 * Separate from `treeBoxes` on purpose. That one grows on the arena's rim as
 * well, and the corridor's whole read depends on its silhouette staying put -
 * so the hub gets its own generator rather than the shared one gaining a mode
 * flag that changes what every chamber looks like.
 *
 * What the hub needed and the arena does not is *variety*. A terrace planted
 * with one shape reads as wallpaper however hard the scale and rotation are
 * jittered, because the eye matches on outline and neither of those changes an
 * outline. Three distinct profiles - a stepped conifer, a broad round crown
 * and a tall bare-trunked one - break the row up on their own.
 *
 * Blocks are tagged 'trunk', 'leafDark', 'leaf' and 'leafLight', darkest at
 * the bottom of a canopy and lightest at the top, so a crown is lit from above
 * by its own colours rather than relying on the sun to model it.
 */
export function lobbyTreeBoxes({ kind = 0, scale = 1, seed = 1 } = {}) {
  let state = (seed * 2654435761 + kind * 40503) % 4294967296
  const rand = () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
  const jitter = (amount) => (rand() - 0.5) * amount
  const s = (v) => v * scale

  const out = []
  const slab = (material, x, y, z, w, h, d, turn) =>
    out.push(
      box(
        material,
        [s(x + jitter(0.12)), s(y), s(z + jitter(0.12))],
        [s(w), s(h), s(d)],
        [0, turn, 0]
      )
    )

  /** A tapering stack of trunk blocks, `segments` tall, ending at `top`. */
  const trunk = (top, base, segments) => {
    const step = top / segments
    for (let i = 0; i < segments; i++) {
      const taper = base * (1 - (i / segments) * 0.36)
      out.push(
        box('trunk', [0, s(step * (i + 0.5)), 0], [s(taper), s(step * 1.02), s(taper)])
      )
    }
  }

  if (kind === 1) {
    /*
     * Broad round crown: four wide plates stacked with a slight turn on each.
     *
     * The turn is what does the work. Four squares stacked square read as one
     * box; the same four rotated fifteen degrees off each other read as a
     * cluster of leaves, and still keep every corner - which a sphere of small
     * cubes never does.
     */
    trunk(2.0, 0.68, 2)
    slab('leafDark', 0, 2.55, 0, 3.5, 0.85, 3.2, 0.15)
    slab('leaf', 0, 3.25, 0, 3.1, 0.8, 2.9, -0.38)
    slab('leaf', 0.15, 3.85, -0.1, 2.5, 0.75, 2.3, 0.55)
    slab('leafLight', -0.1, 4.4, 0.12, 1.7, 0.7, 1.6, -0.2)
    return out
  }

  if (kind === 2) {
    /*
     * Tall and bare-trunked, with the crown held well clear of the ground.
     *
     * Every tree being the same height is as repetitive as every tree being
     * the same shape. This one is the outlier that stops a row from having a
     * flat top - and because its canopy starts above head height, a stand of
     * them still lets you see the cliff they are planted on.
     */
    trunk(3.6, 0.55, 4)
    slab('leafDark', 0, 4.15, 0, 2.4, 0.8, 2.2, 0.24)
    slab('leaf', -0.2, 4.8, 0.15, 2.0, 0.75, 1.9, -0.5)
    slab('leafLight', 0.12, 5.35, -0.1, 1.35, 0.7, 1.3, 0.32)
    return out
  }

  /*
   * Stepped conifer: a square-shouldered cone in four courses.
   *
   * Each course is narrower and shorter than the one under it, which gives the
   * hard stair-stepped edge the whole art style is built on - and reads as a
   * pine from across the plaza without ever going near a smooth taper.
   */
  trunk(1.7, 0.6, 2)
  slab('leafDark', 0, 2.15, 0, 3.6, 0.75, 3.4, 0.12)
  slab('leaf', 0, 2.8, 0, 2.9, 0.7, 2.75, -0.3)
  slab('leaf', 0, 3.4, 0, 2.2, 0.66, 2.1, 0.42)
  slab('leafLight', 0, 3.95, 0, 1.4, 0.62, 1.35, -0.16)
  return out
}

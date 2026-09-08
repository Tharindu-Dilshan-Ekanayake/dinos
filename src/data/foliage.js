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

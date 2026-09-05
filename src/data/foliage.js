/**
 * Tree shapes, described as blocks.
 *
 * Both the hub's terraces and the arena's rim grow the same trees, so the
 * description lives here rather than being written twice.
 *
 * A canopy is a *cluster of cubes*, not two or three big slabs. That is the
 * whole point: at three slabs a tree reads as a cone someone rounded off, and
 * at fourteen cubes it reads as something that was built. It costs nothing
 * extra to draw because the blocks are merged into one geometry per material
 * before they are instanced.
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
  const out = [
    // Trunk: a wider foot under two stacked segments, all visibly separate.
    box('trunk', [0, s(0.3), 0], [s(0.74), s(0.6), s(0.74)]),
    box('trunk', [0, s(1.0), 0], [s(0.56), s(0.9), s(0.56)]),
    box('trunk', [0, s(1.8), 0], [s(0.5), s(0.8), s(0.5)]),
  ]

  /** One ring of cubes around the trunk at a given height. */
  const ring = (material, y, radius, size, count, twist) => {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + twist
      out.push(
        box(
          material,
          [
            s(Math.cos(angle) * radius + jitter(0.18)),
            s(y + jitter(0.16)),
            s(Math.sin(angle) * radius + jitter(0.18)),
          ],
          [s(size), s(size), s(size)],
          [0, angle * 0.35, 0]
        )
      )
    }
  }

  // Broad shaded skirt, a tighter middle, then a lit crown - the cluster
  // narrows as it rises, which is what still reads as a tree from a distance.
  out.push(box('leaf', [0, s(2.5), 0], [s(1.5), s(1.4), s(1.5)]))
  ring('leaf', 2.45, 1.15, 1.15, 5, 0.3)
  ring('leaf', 3.3, 0.85, 1.05, 4, 0.9)
  out.push(box('leafLight', [0, s(3.5), 0], [s(1.3), s(1.2), s(1.3)]))
  ring('leafLight', 4.1, 0.6, 0.85, 3, 0.5)
  out.push(box('leafLight', [0, s(4.6), 0], [s(0.8), s(0.8), s(0.8)], [0, 0.6, 0]))

  return out
}

/** Half-width of a tree's widest ring at scale 1, for keeping it off ledges. */
export const TREE_HALF_WIDTH = 1.75

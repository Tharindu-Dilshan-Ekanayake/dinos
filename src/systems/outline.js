import * as THREE from 'three'

/**
 * Toon-style silhouette outlines - the classic "inverted hull" trick.
 *
 * A second copy of an object's geometry, inflated slightly and rendered with
 * `BackSide` culling in a flat dark colour, draws nothing but a rim: the
 * inflated shell's front faces (which would otherwise cover the real object)
 * are culled, and only the sliver of its back faces poking out past the real
 * mesh's silhouette survives. No shader, no render target, no extra library -
 * it is two ordinary draw calls, which is exactly what this game already does
 * everywhere else it wants a shadow line or a lit edge.
 *
 * `InstancedBlocks` already shares one geometry across every item wearing it,
 * so an outline pass costs one more draw call per *group*, not per instance -
 * a whole ring of cliffs, cut into however many columns, still only costs one
 * outline mesh alongside the one it is outlining.
 */

const CACHE = new Map()

/** A shared, cached BackSide material - callers never need to dispose it. */
export function outlineMaterial(color = '#181511') {
  const hit = CACHE.get(color)
  if (hit) return hit
  const material = new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
    // Toon-shaded neighbours already read as flat colour; an outline lit by
    // the scene's own lights would gain a highlight of its own and stop
    // reading as a stroke. Unlit keeps it a constant dark line regardless of
    // where the sun is.
    toneMapped: false,
  })
  CACHE.set(color, material)
  return material
}

/**
 * Grows a scattered field of boxes by a fixed *world-unit* thickness rather
 * than a percentage.
 *
 * The hub's boxes run from a fifth-of-a-metre grass tuft to a twelve-metre
 * cliff face - a percentage-based outline would be invisible on the tuft and
 * absurd on the cliff. Adding the same handful of centimetres to every axis
 * keeps the stroke a constant width wherever it is drawn, the way a real ink
 * outline would be.
 *
 * `items` are the plain `{ position, rotation, scale, ... }` records
 * `InstancedBlocks` already consumes; only `scale` changes.
 */
export function outlineItems(items, thickness) {
  const grow = thickness * 2
  return items.map((item) => {
    const s = item.scale
    const scale = Array.isArray(s)
      ? [s[0] + grow, s[1] + grow, s[2] + grow]
      : (s ?? 1) + grow
    return { ...item, scale }
  })
}

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * A pile of static boxes, drawn as one mesh per material.
 *
 * The hub is built out of small boxes - a treadmill's handrails, posts,
 * console and bollards come to sixteen meshes, and there are nine treadmills.
 * Every one of those is a separate draw call submitted every frame, for a prop
 * that never moves relative to itself.
 *
 * Merging them changes nothing you can see: the same boxes in the same places
 * in the same colours. What changes is that the GPU is handed four buffers
 * instead of sixteen. This is the version of "make it cheaper" that costs the
 * player nothing, which is the only version worth having - scenery that
 * *disappears* on a lower setting is a worse game, not a faster one.
 *
 * Whether a group casts a shadow is part of its key, so a big slab can still
 * cast while the 20cm rail beside it does not.
 *
 * Merged geometry is meant to be built once and shared - hoist the call to
 * module scope rather than merging per instance.
 */
export function mergeBoxes(boxes) {
  const byKey = new Map()

  for (const box of boxes) {
    const geometry = new THREE.BoxGeometry(box.size[0], box.size[1], box.size[2])
    if (box.rotation) {
      geometry.rotateX(box.rotation[0] ?? 0)
      geometry.rotateY(box.rotation[1] ?? 0)
      geometry.rotateZ(box.rotation[2] ?? 0)
    }
    geometry.translate(box.position[0], box.position[1], box.position[2])

    const shadow = Boolean(box.shadow)
    const key = `${box.material}|${shadow ? 'cast' : 'flat'}`
    const entry = byKey.get(key)
    if (entry) entry.list.push(geometry)
    else byKey.set(key, { material: box.material, shadow, list: [geometry] })
  }

  const out = []
  for (const [key, entry] of byKey) {
    const merged = mergeGeometries(entry.list, false)
    entry.list.forEach((geometry) => geometry.dispose())
    if (merged) out.push({ key, material: entry.material, shadow: entry.shadow, geometry: merged })
  }
  return out
}

/**
 * The same thing for a prop whose boxes depend on its props.
 *
 * Module-scope `mergeBoxes` is better where it fits - one set of buffers for
 * every copy of the prop - but a fence is a different length everywhere it is
 * used, so its geometry belongs to the instance and has to be disposed with it.
 */
export function useMergedBoxes(build, deps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => mergeBoxes(build()), deps)
  useEffect(() => () => groups.forEach((group) => group.geometry.dispose()), [groups])
  return groups
}

/** Draws merged groups with a caller's material map. */
export default function MergedBoxes({ groups, materials }) {
  return (
    <>
      {groups.map((group) => (
        <mesh
          key={group.key}
          geometry={group.geometry}
          material={materials[group.material]}
          castShadow={group.shadow}
          receiveShadow
        />
      ))}
    </>
  )
}

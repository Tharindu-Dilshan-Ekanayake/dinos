import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

/**
 * One draw call for a scatter of identically-materialled boxes.
 *
 * The voxel dressing - grass tufts, pebbles, the chunks breaking up the cliff
 * faces, every part of every tree on the rim - runs to hundreds of pieces per
 * chamber, and three chambers are mounted at once. As individual meshes that
 * is thousands of draw calls for decoration; instanced it is one per piece
 * *kind*.
 *
 * Items are static, so the matrices are written once on mount rather than in a
 * frame loop.
 *
 * `part` is an optional sub-transform applied inside each item's own frame,
 * which is what lets a multi-block prop (trunk, canopy, cap) be drawn as one
 * instanced mesh per block while still rotating and scaling as a single tree.
 */
function composeInto(matrix, scratch, { position, rotation = 0, tilt = 0, roll = 0, scale }) {
  const s = Array.isArray(scale) ? scale : [scale ?? 1, scale ?? 1, scale ?? 1]
  scratch.position.set(position[0], position[1], position[2])
  scratch.euler.set(tilt, rotation, roll)
  scratch.quaternion.setFromEuler(scratch.euler)
  scratch.scale.set(s[0], s[1], s[2])
  matrix.compose(scratch.position, scratch.quaternion, scratch.scale)
}

export default function InstancedBlocks({
  items,
  geometry,
  material,
  part,
  castShadow = false,
  receiveShadow = false,
}) {
  const ref = useRef()
  const scratch = useMemo(
    () => ({
      item: new THREE.Matrix4(),
      part: new THREE.Matrix4(),
      out: new THREE.Matrix4(),
      quaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(),
    }),
    []
  )

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return

    if (part) composeInto(scratch.part, scratch, part)

    items.forEach((item, i) => {
      composeInto(scratch.item, scratch, item)
      if (part) {
        scratch.out.multiplyMatrices(scratch.item, scratch.part)
        mesh.setMatrixAt(i, scratch.out)
      } else {
        mesh.setMatrixAt(i, scratch.item)
      }
    })

    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    /*
     * `geometry` and `material` are dependencies even though nothing here
     * reads them.
     *
     * R3F rebuilds the instancedMesh whenever `args` change, and a new palette
     * hands every chamber new materials - so advancing a stage silently
     * replaced the mesh under us. With only `items` here the effect did not
     * re-run, the fresh mesh kept its identity matrices, and every wall block
     * in the level collapsed into one unit cube at the chamber origin: the
     * cliffs vanished and the trees standing on them were left in the sky.
     */
  }, [items, part, scratch, geometry, material])

  if (items.length === 0) return null

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  )
}

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Bakes a list of described boxes into one geometry per material.
 *
 * This is what lets a prop be built out of a dozen blocks instead of three.
 * The blocks are welded into a single buffer up front, so drawing a tree made
 * of fourteen cubes costs exactly what drawing a tree made of one does - and
 * an instanced field of them costs one call per material, however chunky the
 * model gets.
 *
 * Each box is `{ material, position, size, rotation? }`; rotation is applied
 * about the box's own centre before it is moved into place, so a block can sit
 * askew without dragging the rest of the model with it.
 */
export function mergeBoxesByMaterial(boxes) {
  const byMaterial = new Map()

  for (const box of boxes) {
    const geometry = new THREE.BoxGeometry(box.size[0], box.size[1], box.size[2])
    if (box.rotation) {
      geometry.rotateX(box.rotation[0])
      geometry.rotateY(box.rotation[1])
      geometry.rotateZ(box.rotation[2])
    }
    geometry.translate(box.position[0], box.position[1], box.position[2])

    const list = byMaterial.get(box.material)
    if (list) list.push(geometry)
    else byMaterial.set(box.material, [geometry])
  }

  const out = []
  for (const [key, list] of byMaterial) {
    const merged = mergeGeometries(list, false)
    list.forEach((geometry) => geometry.dispose())
    if (merged) out.push({ key, geometry: merged })
  }
  return out
}

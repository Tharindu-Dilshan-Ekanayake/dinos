import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

/**
 * Biome scatter standing on the arena terraces.
 *
 * One geometry and one material per part, shared across every instance, so a
 * few dozen props cost a handful of draw calls. The materials hold the live
 * palette Colors by reference, which is what lets an area transition recolour
 * the whole scatter without a re-render.
 */

/**
 * Assigning `material.color` keeps the caller's Color instance by reference.
 * Passing it to the constructor instead would silently copy it, and the props
 * would stay frozen on the first biome's palette while everything else lerped.
 */
function withColors(main, accent, colorMain, colorAccent) {
  main.color = colorMain
  accent.color = colorAccent
  return { main, accent }
}

/** Blocky conifer: a trunk under two stacked canopy blocks. */
function treeParts(colorMain, colorAccent) {
  return {
    parts: [
      { geometry: new THREE.BoxGeometry(0.42, 1.5, 0.42), y: 0.75, material: 'accent' },
      { geometry: new THREE.BoxGeometry(2.1, 1.3, 2.1), y: 2.1, material: 'main' },
      { geometry: new THREE.BoxGeometry(1.5, 1.2, 1.5), y: 3.2, material: 'main' },
      { geometry: new THREE.BoxGeometry(0.9, 1.0, 0.9), y: 4.1, material: 'main' },
    ],
    ...withColors(
      new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }),
      new THREE.MeshStandardMaterial({ roughness: 0.9 }),
      colorMain,
      colorAccent
    ),
  }
}

/** Weathered boulder pile. */
function rockParts(colorMain, colorAccent) {
  return {
    parts: [
      { geometry: new THREE.IcosahedronGeometry(1.15, 0), y: 0.85, material: 'main' },
      { geometry: new THREE.IcosahedronGeometry(0.65, 0), y: 0.4, x: 1.1, material: 'accent' },
    ],
    ...withColors(
      new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }),
      new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }),
      colorMain,
      colorAccent
    ),
  }
}

/** Faceted shard, used for both ice and cosmic crystal. */
function crystalParts(colorMain, colorAccent) {
  return {
    parts: [
      { geometry: new THREE.OctahedronGeometry(1.25, 0), y: 1.5, scaleY: 2.1, material: 'main' },
      { geometry: new THREE.OctahedronGeometry(0.7, 0), y: 0.7, x: 0.95, scaleY: 1.7, material: 'accent' },
    ],
    ...withColors(
      new THREE.MeshStandardMaterial({
        roughness: 0.18,
        metalness: 0.1,
        flatShading: true,
        transparent: true,
        opacity: 0.88,
      }),
      new THREE.MeshStandardMaterial({
        roughness: 0.2,
        flatShading: true,
        transparent: true,
        opacity: 0.8,
      }),
      colorMain,
      colorAccent
    ),
  }
}

/** Capped marsh fungus. */
function mushroomParts(colorMain, colorAccent) {
  return {
    parts: [
      { geometry: new THREE.CylinderGeometry(0.22, 0.3, 1.6, 7), y: 0.8, material: 'accent' },
      { geometry: new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), y: 1.6, material: 'main' },
    ],
    ...withColors(
      new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true }),
      new THREE.MeshStandardMaterial({ roughness: 0.8 }),
      colorMain,
      colorAccent
    ),
  }
}

const BUILDERS = {
  tree: treeParts,
  rock: rockParts,
  crystal: crystalParts,
  mushroom: mushroomParts,
}

export default function ArenaProps({ items, kind, colorMain, colorAccent }) {
  // Rebuilt only when the biome's prop type changes - once per area, not per frame.
  const kit = useMemo(() => {
    const build = BUILDERS[kind] ?? BUILDERS.tree
    return build(colorMain, colorAccent)
  }, [kind, colorMain, colorAccent])

  useEffect(
    () => () => {
      kit.parts.forEach((part) => part.geometry.dispose())
      kit.main.dispose()
      kit.accent.dispose()
    },
    [kit]
  )

  return (
    <>
      {items.map((item, i) => (
        <group
          key={i}
          position={item.position}
          rotation-y={item.rotation}
          scale={item.scale}
        >
          {kit.parts.map((part, j) => (
            <mesh
              key={j}
              geometry={part.geometry}
              material={part.material === 'accent' ? kit.accent : kit.main}
              position={[part.x ?? 0, part.y, 0]}
              scale={[1, part.scaleY ?? 1, 1]}
              castShadow
            />
          ))}
        </group>
      ))}
    </>
  )
}

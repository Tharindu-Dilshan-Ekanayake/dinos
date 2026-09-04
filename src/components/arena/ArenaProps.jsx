import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import InstancedBlocks from '../InstancedBlocks.jsx'

/**
 * Biome scatter standing on the arena terraces.
 *
 * Every prop is assembled from a handful of blocks - stacked, offset and
 * turned a few degrees off-square so they look hand-placed rather than
 * extruded. Nothing here is a sphere: the rim has to read as the same voxel
 * world as the terrain it stands on.
 *
 * Each block of a prop is drawn as one InstancedMesh across the whole scatter,
 * so four dozen trees cost four draw calls rather than two hundred.
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

const blockMaterial = (extra = {}) =>
  new THREE.MeshStandardMaterial({ roughness: 0.88, flatShading: true, ...extra })

/** Blocky conifer: a slab trunk under three staggered canopy blocks. */
function treeParts(colorMain, colorAccent) {
  return {
    parts: [
      { geometry: new THREE.BoxGeometry(0.5, 2, 0.5), position: [0, 1, 0], material: 'accent' },
      { geometry: new THREE.BoxGeometry(2.8, 1.2, 2.8), position: [0, 2.5, 0], material: 'main' },
      {
        geometry: new THREE.BoxGeometry(2.05, 1.1, 2.05),
        position: [0, 3.5, 0],
        // Turned off-square: two stacked boxes in line read as one tapered
        // cone, which is exactly the shape this is trying not to be.
        rotation: 0.5,
        material: 'main',
      },
      { geometry: new THREE.BoxGeometry(1.15, 0.95, 1.15), position: [0, 4.3, 0], material: 'main' },
    ],
    ...withColors(blockMaterial(), blockMaterial({ roughness: 0.95 }), colorMain, colorAccent),
  }
}

/** Boulder pile: three blocks tipped against each other. */
function rockParts(colorMain, colorAccent) {
  return {
    parts: [
      {
        geometry: new THREE.BoxGeometry(1.9, 1.3, 1.7),
        position: [0, 0.62, 0],
        rotation: 0.3,
        material: 'main',
      },
      {
        geometry: new THREE.BoxGeometry(1.15, 0.9, 1.2),
        position: [0.15, 1.55, -0.1],
        rotation: -0.45,
        material: 'main',
      },
      {
        geometry: new THREE.BoxGeometry(0.85, 0.65, 0.85),
        position: [1.25, 0.32, 0.2],
        rotation: 0.6,
        material: 'accent',
      },
    ],
    ...withColors(
      blockMaterial({ roughness: 1 }),
      blockMaterial({ roughness: 1 }),
      colorMain,
      colorAccent
    ),
  }
}

/**
 * Faceted shard, used for both ice and cosmic crystal.
 *
 * A four-sided tapered prism: still a hard-edged solid, but tapered, so the
 * crystal biomes do not look like the rock biome in a different colour.
 */
function crystalParts(colorMain, colorAccent) {
  const facet = { roughness: 0.2, flatShading: true, transparent: true }
  return {
    parts: [
      {
        geometry: new THREE.CylinderGeometry(0.3, 0.75, 3, 4),
        position: [0, 1.5, 0],
        rotation: 0.4,
        material: 'main',
      },
      {
        geometry: new THREE.CylinderGeometry(0.18, 0.46, 1.8, 4),
        position: [0.95, 0.9, 0.2],
        rotation: -0.35,
        material: 'accent',
      },
    ],
    ...withColors(
      blockMaterial({ ...facet, metalness: 0.1, opacity: 0.9 }),
      blockMaterial({ ...facet, opacity: 0.82 }),
      colorMain,
      colorAccent
    ),
  }
}

/** Capped marsh fungus, squared off. */
function mushroomParts(colorMain, colorAccent) {
  return {
    parts: [
      { geometry: new THREE.BoxGeometry(0.45, 1.5, 0.45), position: [0, 0.75, 0], material: 'accent' },
      { geometry: new THREE.BoxGeometry(2.1, 0.55, 2.1), position: [0, 1.75, 0], material: 'main' },
      {
        geometry: new THREE.BoxGeometry(1.25, 0.45, 1.25),
        position: [0, 2.2, 0],
        rotation: 0.4,
        material: 'main',
      },
    ],
    ...withColors(blockMaterial({ roughness: 0.7 }), blockMaterial(), colorMain, colorAccent),
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
      {kit.parts.map((part, i) => (
        <InstancedBlocks
          key={i}
          items={items}
          geometry={part.geometry}
          material={part.material === 'accent' ? kit.accent : kit.main}
          part={part}
          castShadow
        />
      ))}
    </>
  )
}

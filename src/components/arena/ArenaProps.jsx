import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { treeBoxes } from '../../data/foliage.js'
import { mergeBoxesByMaterial } from '../../systems/mergeBoxes.js'
import { voxelTintMap } from '../../systems/voxelTexture.js'
import InstancedBlocks from '../InstancedBlocks.jsx'

/**
 * Biome scatter standing on the arena terraces.
 *
 * Every prop is assembled from a handful of blocks - stacked, offset and
 * turned a few degrees off-square so they look hand-placed rather than
 * extruded. Nothing here is a sphere: the rim has to read as the same voxel
 * world as the terrain it stands on.
 *
 * A prop's blocks are welded into one geometry per material before they are
 * instanced, so a tree built from fourteen cubes draws in the same two calls a
 * tree built from two would. That is what pays for the chunky canopies.
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

/**
 * Moulded studs, tinted at runtime.
 *
 * The map is painted white so it multiplies against `material.color`, which
 * these props hold by reference from the live biome palette - a colour baked
 * into the canvas would freeze every prop on the first biome it saw.
 */
const STUD_MAP = { pattern: 'studs', cells: 4, variance: 0.06, fleckDepth: 0.22, seed: 61 }

const blockMaterial = (extra = {}) =>
  new THREE.MeshStandardMaterial({
    roughness: 0.88,
    flatShading: true,
    map: voxelTintMap(STUD_MAP),
    ...extra,
  })

/**
 * Chunky conifer: a stacked trunk under a cluster of canopy cubes.
 *
 * The shape is shared with the hub's terraces - see data/foliage.js - so both
 * halves of the game grow the same trees.
 */
function treeParts(colorMain, colorAccent) {
  const boxes = treeBoxes({ seed: 7 }).map((part) => ({
    ...part,
    // The scatter carries only two tints, so the whole canopy rides the main
    // colour and the trunk rides the accent.
    material: part.material === 'trunk' ? 'accent' : 'main',
  }))

  return {
    boxes,
    ...withColors(blockMaterial(), blockMaterial({ roughness: 0.95 }), colorMain, colorAccent),
  }
}

/** Boulder pile: blocks tipped against each other, with rubble alongside. */
function rockParts(colorMain, colorAccent) {
  return {
    boxes: [
      { material: 'main', position: [0, 0.62, 0], size: [1.9, 1.3, 1.7], rotation: [0, 0.3, 0] },
      { material: 'main', position: [0.15, 1.55, -0.1], size: [1.15, 0.9, 1.2], rotation: [0, -0.45, 0] },
      { material: 'main', position: [-0.9, 0.4, 0.5], size: [0.9, 0.8, 0.95], rotation: [0, 0.8, 0] },
      { material: 'accent', position: [1.25, 0.32, 0.2], size: [0.85, 0.65, 0.85], rotation: [0, 0.6, 0] },
      { material: 'accent', position: [0.2, 2.15, 0.1], size: [0.6, 0.5, 0.6], rotation: [0, 0.2, 0] },
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
 * Stepped shard, used for both ice and cosmic crystal.
 *
 * Blocks shrinking as they rise rather than a smooth taper, so the crystal
 * biomes still read as built out of the same bricks as everything else while
 * not looking like the rock biome in a different colour.
 */
function crystalParts(colorMain, colorAccent) {
  const facet = { roughness: 0.2, flatShading: true, transparent: true }
  return {
    // Stepped rather than tapered: a crystal built out of shrinking blocks
    // belongs in this world in a way a smooth cone does not.
    boxes: [
      { material: 'main', position: [0, 0.5, 0], size: [1.15, 1, 1.15], rotation: [0, 0.4, 0] },
      { material: 'main', position: [0, 1.45, 0], size: [0.85, 1, 0.85], rotation: [0, 0.4, 0] },
      { material: 'main', position: [0, 2.3, 0], size: [0.55, 0.8, 0.55], rotation: [0, 0.4, 0] },
      { material: 'main', position: [0, 2.95, 0], size: [0.3, 0.6, 0.3], rotation: [0, 0.4, 0] },
      { material: 'accent', position: [0.95, 0.4, 0.2], size: [0.7, 0.8, 0.7], rotation: [0, -0.35, 0] },
      { material: 'accent', position: [0.95, 1.1, 0.2], size: [0.42, 0.7, 0.42], rotation: [0, -0.35, 0] },
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
    boxes: [
      { material: 'accent', position: [0, 0.4, 0], size: [0.6, 0.8, 0.6] },
      { material: 'accent', position: [0, 1.1, 0], size: [0.45, 0.7, 0.45] },
      { material: 'main', position: [0, 1.75, 0], size: [2.1, 0.55, 2.1] },
      { material: 'main', position: [0, 2.2, 0], size: [1.25, 0.45, 1.25], rotation: [0, 0.4, 0] },
      { material: 'main', position: [0, 2.6, 0], size: [0.6, 0.35, 0.6], rotation: [0, 0.8, 0] },
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
    const built = build(colorMain, colorAccent)
    return { ...built, groups: mergeBoxesByMaterial(built.boxes) }
  }, [kind, colorMain, colorAccent])

  useEffect(
    () => () => {
      kit.groups.forEach((group) => group.geometry.dispose())
      kit.main.dispose()
      kit.accent.dispose()
    },
    [kit]
  )

  return (
    <>
      {kit.groups.map((group) => (
        <InstancedBlocks
          key={group.key}
          items={items}
          geometry={group.geometry}
          material={group.key === 'accent' ? kit.accent : kit.main}
          castShadow
        />
      ))}
    </>
  )
}

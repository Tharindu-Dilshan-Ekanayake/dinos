import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { buildHubApproach } from '../../data/arena.js'
import { LOBBY_PALETTE } from '../../data/lobby.js'
import { voxelMaterial } from '../../systems/voxelTexture.js'
import InstancedBlocks from '../InstancedBlocks.jsx'

/**
 * The view out through the arena's mouth.
 *
 * Stage 1 used to open onto an endless flat plain, because chamber zero is the
 * one chamber with nothing in front of it - every other level looks back into
 * the previous one's back wall. This is what is out there instead: the flight
 * of steps you climbed to get in, and the hub at the bottom of them.
 *
 * Scenery, not level. You cannot walk down there - the mouth hands you back to
 * the lobby a few paces short of the top step - so it is one instanced draw
 * per material and nothing in it moves, thinks or is ever hit.
 *
 * Colours are the hub's own, seen through whatever the arena's air is doing:
 * the scene fog is the biome's, so from inside Jungle Hollow the plaza reads
 * as green-hazed distance rather than as a second scene pasted into the first.
 */

/** World size of one texture repeat, matched to the chambers' ground. */
const STUD_SPAN = 5.2

export default function HubApproach() {
  const items = useMemo(() => buildHubApproach(), [])

  /*
   * Voxel textures are UV-mapped per box face and instances scale that mapping
   * with them, so a repeat is only right for one size of block. Each group
   * gets its own material tuned to the size the pieces in it actually are -
   * the plaza is sixty units deep and a stair tread is one and a half.
   */
  const materials = useMemo(() => {
    const p = LOBBY_PALETTE
    const spanOf = (item, axis) => Math.max(1, Math.round(item.scale[axis] / STUD_SPAN))
    const plaza = items.paving[0]
    const ground = items.grass[0]

    return {
      paving: voxelMaterial(p.path, {
        pattern: 'studs',
        cells: 4,
        variance: 0.05,
        fleckDepth: 0.16,
        accent: p.pathEdge,
        repeat: [spanOf(plaza, 0), spanOf(plaza, 2)],
        seed: 11,
      }),
      walkway: voxelMaterial(p.walkway, {
        pattern: 'studs',
        cells: 4,
        variance: 0.04,
        fleckDepth: 0.14,
        repeat: [2, spanOf(plaza, 2)],
        seed: 17,
      }),
      steps: voxelMaterial(p.path, {
        pattern: 'studs',
        cells: 4,
        variance: 0.05,
        fleckDepth: 0.16,
        accent: p.pathEdge,
        seed: 11,
      }),
      grass: voxelMaterial(p.grass, {
        pattern: 'studs',
        cells: 8,
        variance: 0.08,
        fleck: 0.3,
        fleckDepth: 0.17,
        repeat: [spanOf(ground, 0), spanOf(ground, 2)],
        seed: 23,
      }),
      wall: voxelMaterial(p.wall, {
        pattern: 'studs',
        cells: 6,
        variance: 0.1,
        fleck: 0.34,
        fleckDepth: 0.22,
        repeat: [2, 3],
        seed: 29,
      }),
      wallTop: new THREE.MeshStandardMaterial({
        color: p.wallTop,
        roughness: 0.92,
        flatShading: true,
      }),
      podium: new THREE.MeshStandardMaterial({
        color: p.pathEdge,
        roughness: 0.9,
        flatShading: true,
      }),
      // The x1 training pad's own colour - the rest of the row is too far off
      // to read as anything but a line of pale squares.
      pad: new THREE.MeshStandardMaterial({
        color: '#e2e8f0',
        roughness: 0.7,
        flatShading: true,
      }),
    }
  }, [items])

  const block = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])

  useEffect(
    () => () => {
      Object.values(materials).forEach((m) => m.dispose())
      block.dispose()
    },
    [materials, block]
  )

  return (
    <group>
      <InstancedBlocks items={items.grass} geometry={block} material={materials.grass} />
      <InstancedBlocks items={items.paving} geometry={block} material={materials.paving} />
      <InstancedBlocks items={items.walkway} geometry={block} material={materials.walkway} />
      <InstancedBlocks items={items.steps} geometry={block} material={materials.steps} />
      <InstancedBlocks items={items.wall} geometry={block} material={materials.wall} />
      <InstancedBlocks items={items.wallTop} geometry={block} material={materials.wallTop} />
      <InstancedBlocks items={items.podium} geometry={block} material={materials.podium} />
      <InstancedBlocks items={items.pad} geometry={block} material={materials.pad} />
    </group>
  )
}

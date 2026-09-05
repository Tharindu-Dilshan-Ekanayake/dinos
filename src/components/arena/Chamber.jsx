import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  ARENA,
  CHAMBER_SPAN,
  buildArenaBlocks,
  buildArenaProps,
  buildCliffDetails,
  buildGlowVeins,
  buildGroundPatches,
  buildGroundScatter,
} from '../../data/arena.js'
import { shadeColor } from '../../data/areas.js'
import { voxelMaterial } from '../../systems/voxelTexture.js'
import InstancedBlocks from '../InstancedBlocks.jsx'
import ArenaProps from './ArenaProps.jsx'

/**
 * One level's chamber, drawn at its own place in the corridor.
 *
 * Everything here is boxes: a grass-capped ground slab, terraces of dirt and
 * stone stepping up and away, loose chunks hanging off their faces, and tufts
 * and pebbles scattered over the floor. Nothing is smooth-shaded and nothing
 * is a smooth surface - the whole chamber is built the way the blocks in a
 * voxel game are, which is what gives it the chunky cartoon read.
 *
 * A chamber's palette never changes: it belongs to one level for the life of
 * the run. That means no per-frame colour lerping here at all, and it is what
 * lets you see the *next* level's colours through the gate before you walk
 * into them.
 */

/** Ground slab. Exactly one chamber deep, so neighbours tile without overlap. */
const FLOOR_WIDTH = 110
const FLOOR_THICKNESS = 1.6

/** World size of one ground texture repeat - two floor tiles across. */
const GROUND_SPAN = ARENA.tileSize * 2

/** Grass lid on every terrace block, sunk slightly so no seam shows. */
const CAP_HEIGHT = 0.6
const CAP_SINK = 0.08
/** How far a cap's upper face sits above the block it lids. */
const CAP_RISE = CAP_HEIGHT - CAP_SINK

export default function Chamber({ palette, origin, stage = 0 }) {
  const blocks = useMemo(() => buildArenaBlocks(), [])
  const props = useMemo(() => buildArenaProps(blocks, stage), [blocks, stage])
  const veins = useMemo(() => buildGlowVeins(), [])

  // Per-level dressing: the walls repeat down the corridor, the scatter on
  // them does not.
  const details = useMemo(() => buildCliffDetails(blocks, stage), [blocks, stage])
  const patches = useMemo(() => {
    const all = buildGroundPatches(stage)
    return { light: all.filter((p) => p.light), dark: all.filter((p) => !p.light) }
  }, [stage])
  const scatter = useMemo(() => buildGroundScatter(stage), [stage])

  // Terraces split by tier so the walls read as depth rather than one mass.
  const tiers = useMemo(
    () => ({
      near: blocks
        .filter((b) => b.tier === 0)
        .map((b) => ({ position: b.position, scale: b.size })),
      far: blocks
        .filter((b) => b.tier > 0)
        .map((b) => ({ position: b.position, scale: b.size })),
      caps: blocks.map((b) => ({
        position: [b.position[0], b.top + CAP_HEIGHT / 2 - CAP_SINK, b.position[2]],
        // A hair wider than the block, so the grass overhangs its own cliff.
        scale: [b.size[0] * 1.03, CAP_HEIGHT, b.size[2] * 1.03],
      })),
    }),
    [blocks]
  )

  const materials = useMemo(() => {
    const ground = voxelMaterial(palette.floorA, {
      pattern: 'studs',
      cells: 8,
      variance: 0.075,
      fleck: 0.3,
      fleckDepth: 0.16,
      repeat: [
        Math.round(FLOOR_WIDTH / GROUND_SPAN),
        Math.round(CHAMBER_SPAN / GROUND_SPAN),
      ],
      seed: 21,
    })
    const dirt = voxelMaterial(palette.cliff, {
      pattern: 'studs',
      cells: 8,
      variance: 0.11,
      fleck: 0.36,
      fleckDepth: 0.24,
      seed: 53,
    })

    return {
      ground,
      dirt,
      stone: voxelMaterial(palette.cliffDark, {
        pattern: 'studs',
        cells: 8,
        variance: 0.1,
        fleck: 0.34,
        fleckDepth: 0.22,
        seed: 89,
      }),
      cap: voxelMaterial(palette.cliffTop, {
        pattern: 'studs',
        cells: 8,
        variance: 0.09,
        fleck: 0.3,
        fleckDepth: 0.18,
        repeat: 2,
        seed: 71,
      }),
      chunk: voxelMaterial(shadeColor(palette.cliff, -0.06), {
        pattern: 'studs',
        cells: 4,
        variance: 0.12,
        fleck: 0.4,
        fleckDepth: 0.2,
        seed: 131,
      }),
      // Two tones of the floor, laid over it as blocky clearings.
      patchLight: voxelMaterial(shadeColor(palette.floorA, 0.07), {
        pattern: 'studs',
        cells: 8,
        variance: 0.07,
        fleck: 0.26,
        fleckDepth: 0.15,
        repeat: 2,
        seed: 37,
      }),
      patchDark: voxelMaterial(palette.floorB, {
        pattern: 'studs',
        cells: 8,
        variance: 0.07,
        fleck: 0.26,
        fleckDepth: 0.15,
        repeat: 2,
        seed: 41,
      }),
      tuft: new THREE.MeshStandardMaterial({
        color: palette.tuft,
        roughness: 0.85,
        flatShading: true,
      }),
      pebble: new THREE.MeshStandardMaterial({
        color: shadeColor(palette.cliffDark, -0.05),
        roughness: 1,
        flatShading: true,
      }),
      // Biomes that grow nothing leave this null and the scatter is skipped.
      flower: palette.flower
        ? new THREE.MeshStandardMaterial({
            color: palette.flower,
            roughness: 0.6,
            flatShading: true,
            emissive: new THREE.Color(palette.flower),
            emissiveIntensity: 0.15,
          })
        : null,
      glow: new THREE.MeshBasicMaterial({
        color: palette.glow,
        transparent: true,
        opacity: palette.glowStrength * 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    }
  }, [palette])

  /** Grass on the lid, dirt down the sides: [+x, -x, +y, -y, +z, -z]. */
  const slabMaterials = useMemo(
    () => [
      materials.dirt,
      materials.dirt,
      materials.ground,
      materials.dirt,
      materials.dirt,
      materials.dirt,
    ],
    [materials]
  )

  const geometries = useMemo(
    () => ({
      block: new THREE.BoxGeometry(1, 1, 1),
      // A single blade - four-sided and tapered - scaled per instance into a
      // leaning tuft. Unit height, so an instance's Y scale is its height.
      blade: new THREE.CylinderGeometry(0.045, 0.11, 1, 4),
      vein: new THREE.PlaneGeometry(1, 1),
    }),
    []
  )

  const propColors = useMemo(
    () => ({
      main: new THREE.Color(palette.propColor),
      accent: new THREE.Color(palette.propAccent),
    }),
    [palette]
  )

  useEffect(
    () => () => {
      // Materials are ours; their maps belong to the shared texture cache.
      Object.values(materials).forEach((m) => m?.dispose())
      Object.values(geometries).forEach((g) => g.dispose())
    },
    [materials, geometries]
  )

  return (
    <group position={[0, 0, origin]}>
      {/*
        The ground is a slab, not a plane: its top face lands exactly on y=0 and
        it is exactly one chamber deep, so the corridor tiles end to end with no
        overlapping coplanar floors to z-fight, and the dirt in its sides is
        what you see where the terrain is cut away.
      */}
      <mesh
        position-y={-FLOOR_THICKNESS / 2}
        material={slabMaterials}
        receiveShadow
      >
        <boxGeometry args={[FLOOR_WIDTH, FLOOR_THICKNESS, CHAMBER_SPAN]} />
      </mesh>

      {/* Blocky clearings breaking up the grass. */}
      <InstancedBlocks
        items={patches.light}
        geometry={geometries.block}
        material={materials.patchLight}
        receiveShadow
      />
      <InstancedBlocks
        items={patches.dark}
        geometry={geometries.block}
        material={materials.patchDark}
        receiveShadow
      />

      {palette.glowStrength > 0 &&
        veins.map((vein, i) => (
          <mesh
            key={i}
            geometry={geometries.vein}
            material={materials.glow}
            position={vein.position}
            rotation={[-Math.PI / 2, 0, vein.rotation]}
            scale={[vein.width, vein.length, 1]}
          />
        ))}

      {/* Terraces: dirt at the fighting floor, stone stepping away behind it. */}
      <InstancedBlocks
        items={tiers.near}
        geometry={geometries.block}
        material={materials.dirt}
        castShadow
        receiveShadow
      />
      <InstancedBlocks
        items={tiers.far}
        geometry={geometries.block}
        material={materials.stone}
        castShadow
        receiveShadow
      />
      <InstancedBlocks
        items={tiers.caps}
        geometry={geometries.block}
        material={materials.cap}
        castShadow
        receiveShadow
      />
      <InstancedBlocks
        items={details}
        geometry={geometries.block}
        material={materials.chunk}
        castShadow
        receiveShadow
      />

      {/* Ground cover. Small, everywhere, and never a shadow caster. */}
      <InstancedBlocks
        items={scatter.tufts}
        geometry={geometries.blade}
        material={materials.tuft}
      />
      <InstancedBlocks
        items={scatter.pebbles}
        geometry={geometries.block}
        material={materials.pebble}
        receiveShadow
      />

      {/* Flowers: a stem out of the grass with a bright head on top. */}
      {materials.flower && (
        <>
          <InstancedBlocks
            items={scatter.flowers}
            geometry={geometries.blade}
            material={materials.tuft}
            part={{ position: [0, 0.26, 0], scale: [0.7, 0.52, 0.7] }}
          />
          <InstancedBlocks
            items={scatter.flowers}
            geometry={geometries.block}
            material={materials.flower}
            part={{ position: [0, 0.58, 0], scale: [0.28, 0.2, 0.28] }}
          />
        </>
      )}

      {/* Props stand on the grass caps, not on the bare block beneath them. */}
      <group position-y={CAP_RISE}>
        <ArenaProps
          items={props}
          kind={palette.prop}
          colorMain={propColors.main}
          colorAccent={propColors.accent}
        />
      </group>
    </group>
  )
}

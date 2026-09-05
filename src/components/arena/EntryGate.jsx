import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ARENA, ENTRY_TRIGGER, chamberOrigin } from '../../data/arena.js'
import { paletteForStage } from '../../data/areas.js'
import { voxelMaterial } from '../../systems/voxelTexture.js'

const WIDTH = ARENA.gapHalfWidth * 2

/*
 * Low, and standing wide of the opening rather than across it.
 *
 * The camera orbits about nine units up and nineteen back, so anything here is
 * between the lens and the level behind you. Three versions learned that the
 * hard way - an arch that blocked the chamber, a full-width plank at head
 * height, then a signpost that still stood squarely in front of the level it
 * was naming. The way back does not need a label: the level you came from is
 * right there, visible down the corridor, and a board saying so was covering
 * the only thing worth looking at.
 */
const POST_HEIGHT = 1.7

/**
 * The way back.
 *
 * Walking into the near end of a chamber retreats one level; doing it in Stage
 * 1 walks you out of the arena and banks the run. There is no menu shortcut
 * home - the way out is the way you came.
 *
 * Two posts and a glow on the floor between them, nothing more. Which level
 * you are in is decided by where you are standing, in ArenaTravel, so these
 * are free to be pure threshold: they mark where one chamber's floor ends
 * without standing in the mouth of the next.
 *
 * One stands in every mounted chamber, so looking back down the corridor shows
 * the thresholds of the levels you came through rather than bare ground.
 */
export default function EntryGate({ stage }) {
  const glowRef = useRef()
  const anim = useRef({ phase: 0 })

  /*
   * Built like everything else in the world: a coursed stone post in the
   * biome's own rock under a warm lamp.
   */
  const materials = useMemo(() => {
    const palette = paletteForStage(stage)
    return {
      post: voxelMaterial(palette.cliffDark, {
        pattern: 'bricks',
        cells: 4,
        variance: 0.09,
        fleckDepth: 0.2,
        seed: 149,
      }),
      lamp: new THREE.MeshStandardMaterial({
        color: '#ffd76b',
        emissive: new THREE.Color('#ffb703'),
        emissiveIntensity: 0.9,
        roughness: 0.4,
        flatShading: true,
      }),
    }
  }, [stage])

  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

  useFrame((_, rawDelta) => {
    anim.current.phase += Math.min(rawDelta, 0.05)
    if (glowRef.current) {
      glowRef.current.material.opacity = 0.16 + Math.sin(anim.current.phase * 2) * 0.06
    }
  })

  return (
    <group position={[0, 0, chamberOrigin(stage) + ENTRY_TRIGGER.z]}>
      {/* Wide of the gap, so the corridor between chambers stays clear. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (ARENA.gapHalfWidth + 0.45), 0, 0]}>
          <mesh material={materials.post} position={[0, POST_HEIGHT / 2, 0]} castShadow>
            <boxGeometry args={[0.72, POST_HEIGHT, 1.1]} />
          </mesh>
          <mesh material={materials.lamp} position={[0, POST_HEIGHT + 0.2, 0]}>
            <boxGeometry args={[0.54, 0.4, 0.8]} />
          </mesh>
        </group>
      ))}

      <mesh ref={glowRef} rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
        <planeGeometry args={[WIDTH, 2.4]} />
        <meshBasicMaterial
          color="#9fd8ff"
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
        />
      </mesh>
    </group>
  )
}

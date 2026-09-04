import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { ARENA, ENTRY_TRIGGER, chamberOrigin } from '../../data/arena.js'
import { paletteForStage } from '../../data/areas.js'
import { formatNumber } from '../../data/progression.js'
import { useGameStore } from '../../store/useGameStore.js'
import { playerPosition } from '../../systems/playerState.js'
import { voxelMaterial } from '../../systems/voxelTexture.js'

const WIDTH = ARENA.gapHalfWidth * 2
/*
 * Deliberately low. The camera sits behind the player, so this marker is
 * always between the lens and the action - an arch here would block the whole
 * chamber, which is exactly what the first version did.
 */
const HEIGHT = 1.5

/**
 * The way back.
 *
 * Walking into the near end of a chamber retreats one level; doing it in Stage
 * 1 walks you out of the arena and banks the run. There is no menu shortcut
 * home - the way out is the way you came.
 */
export default function EntryGate() {
  const stageIndex = useGameStore((s) => s.stageIndex)
  const runWins = useGameStore((s) => s.runWins)
  const dead = useGameStore((s) => s.dead)

  const armed = useRef(false)
  const glowRef = useRef()
  const anim = useRef({ phase: 0 })

  /*
   * Waymarkers, built like everything else in the world: a coursed stone post
   * in the biome's own rock under a warm lamp. The pair used to be flat dark
   * boxes, which read as two crates left in the middle of every arena.
   */
  const materials = useMemo(() => {
    const palette = paletteForStage(stageIndex)
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
  }, [stageIndex])

  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

  // Every arrival lands the player near this trigger, so it must be re-armed
  // by stepping away before it can fire.
  useEffect(() => {
    armed.current = false
  }, [stageIndex])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    anim.current.phase += delta

    if (glowRef.current) {
      glowRef.current.material.opacity = 0.16 + Math.sin(anim.current.phase * 2) * 0.06
    }

    if (dead) return

    const triggerZ = chamberOrigin(stageIndex) + ENTRY_TRIGGER.z
    const inside =
      playerPosition.z >= triggerZ - ENTRY_TRIGGER.radius &&
      Math.abs(playerPosition.x) <= ARENA.gapHalfWidth + 1.5

    if (!inside) armed.current = true
    if (inside && armed.current) {
      armed.current = false
      useGameStore.getState().retreatStage()
    }
  })

  const leaving = stageIndex <= 0

  return (
    <group position={[0, 0, chamberOrigin(stageIndex) + ENTRY_TRIGGER.z]}>
      {/* Low posts either side, no lintel - the camera looks straight through. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (ARENA.gapHalfWidth + 0.5), 0, 0]}>
          <mesh material={materials.post} position={[0, HEIGHT / 2, 0]} castShadow>
            <boxGeometry args={[0.9, HEIGHT, 1.3]} />
          </mesh>
          <mesh material={materials.lamp} position={[0, HEIGHT + 0.22, 0]}>
            <boxGeometry args={[0.62, 0.44, 0.9]} />
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

      <Billboard position={[0, HEIGHT + 0.9, 0]}>
        <Text
          fontSize={0.36}
          color="#bfe0f2"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#12100e"
          maxWidth={9}
          textAlign="center"
        >
          {leaving
            ? `Leave with ${formatNumber(runWins)} Wins`
            : `Back to Stage ${stageIndex}`}
        </Text>
      </Billboard>
    </group>
  )
}

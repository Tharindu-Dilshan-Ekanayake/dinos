import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { PAD_RADIUS, padRate, padUnlocked } from '../../data/training.js'
import { formatNumber } from '../../data/progression.js'
import { useGameStore } from '../../store/useGameStore.js'
import { playerPosition } from '../../systems/playerState.js'

/**
 * A training pad: stand on it and your dino trains, adding permanent Damage at
 * the pad's multiplier.
 *
 * The "am I standing on it" test and every bit of the pad's animation run from
 * useFrame against the shared player position, so a row of nine pads costs no
 * React renders while you walk the hub.
 */
export default function TrainingPad({ pad, position }) {
  const rebirths = useGameStore((s) => s.rebirths)
  const unlocked = padUnlocked(pad, rebirths)

  const padRef = useRef()
  const glowRef = useRef()
  const beamRef = useRef()
  const anim = useRef({ active: 0, phase: Math.random() * 6 })

  const materials = useMemo(() => {
    const surface = new THREE.MeshStandardMaterial({
      color: unlocked ? pad.color : '#4b5563',
      roughness: 0.55,
      flatShading: true,
      emissive: new THREE.Color(unlocked ? pad.accent : '#111827'),
      emissiveIntensity: unlocked ? 0.25 : 0,
    })
    const frame = new THREE.MeshStandardMaterial({
      color: unlocked ? pad.accent : '#374151',
      roughness: 0.6,
      flatShading: true,
    })
    return { surface, frame }
  }, [pad, unlocked])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const a = anim.current
    a.phase += delta

    const dx = playerPosition.x - position[0]
    const dz = playerPosition.z - position[2]
    const standing = unlocked && dx * dx + dz * dz < PAD_RADIUS * PAD_RADIUS

    a.active += ((standing ? 1 : 0) - a.active) * Math.min(1, delta * 8)

    if (padRef.current) {
      materials.surface.emissiveIntensity =
        (unlocked ? 0.25 : 0) + a.active * (0.7 + Math.sin(a.phase * 6) * 0.2)
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = (unlocked ? 0.25 : 0.08) + a.active * 0.5
      glowRef.current.rotation.z += delta * (0.5 + a.active * 2.5)
    }
    if (beamRef.current) {
      beamRef.current.visible = a.active > 0.02
      beamRef.current.scale.set(1, 1 + Math.sin(a.phase * 4) * 0.12, 1)
      beamRef.current.material.opacity = a.active * 0.35
      beamRef.current.rotation.y += delta * 1.2
    }
  })

  const rate = padRate(pad)

  return (
    <group position={position}>
      {/* Raised frame + glowing surface */}
      <mesh material={materials.frame} position={[0, 0.14, 0]} receiveShadow castShadow>
        <boxGeometry args={[4, 0.28, 4]} />
      </mesh>
      <mesh ref={padRef} material={materials.surface} position={[0, 0.3, 0]} receiveShadow>
        <boxGeometry args={[3.5, 0.1, 3.5]} />
      </mesh>

      <mesh ref={glowRef} position={[0, 0.37, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.2, 1.7, 6]} />
        <meshBasicMaterial
          color={unlocked ? pad.accent : '#6b7280'}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      {/* Column of light while training */}
      <mesh ref={beamRef} position={[0, 2.6, 0]} visible={false}>
        <cylinderGeometry args={[1.5, 1.1, 5, 6, 1, true]} />
        <meshBasicMaterial
          color={pad.accent}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </mesh>

      {/* Back post carrying the sign */}
      <mesh material={materials.frame} position={[0, 1.6, -2.1]} castShadow>
        <boxGeometry args={[0.28, 3.2, 0.28]} />
      </mesh>

      <Billboard position={[0, 3.9, -2.1]}>
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[2.7, 1.1]} />
          <meshBasicMaterial color="#0b1220" transparent opacity={0.84} fog={false} />
        </mesh>

        <Text
          position={[0, 0.31, 0]}
          fontSize={0.31}
          color={unlocked ? pad.color : '#94a3b8'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.026}
          outlineColor="#0b1220"
        >
          {`x${pad.multiplier} Damage`}
        </Text>

        <Text
          position={[0, -0.03, 0]}
          fontSize={0.18}
          color="#e2e8f0"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.018}
          outlineColor="#0b1220"
        >
          {`+${formatNumber(rate)}/sec`}
        </Text>

        <Text
          position={[0, -0.33, 0]}
          fontSize={0.17}
          color={unlocked ? '#86efac' : '#fca5a5'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.017}
          outlineColor="#0b1220"
        >
          {unlocked
            ? 'STAND TO TRAIN'
            : `${pad.requiresRebirths} Rebirth${pad.requiresRebirths === 1 ? '' : 's'}`}
        </Text>
      </Billboard>
    </group>
  )
}

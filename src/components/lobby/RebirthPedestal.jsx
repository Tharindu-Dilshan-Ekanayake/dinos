import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { REBIRTH_WINS_REQUIRED, formatNumber } from '../../data/progression.js'
import { INTERACT_RADIUS } from '../../data/lobby.js'
import { useGameStore } from '../../store/useGameStore.js'
import { playerPosition } from '../../systems/playerState.js'
import { voxelMaterial } from '../../systems/voxelTexture.js'

/**
 * A rebirth milestone pedestal. Walking up to one and tapping it opens the
 * rebirth confirmation - the same guarded flow as the HUD button, so there is
 * still no way to rebirth by accident.
 */
export default function RebirthPedestal({ pedestal, position, onOpen }) {
  const rebirths = useGameStore((s) => s.rebirths)
  const totalWins = useGameStore((s) => s.totalWins)

  const achieved = rebirths >= pedestal.rebirths
  const ready = totalWins >= REBIRTH_WINS_REQUIRED

  const crystal = useRef()
  const ringRef = useRef()
  const anim = useRef({ near: 0, phase: Math.random() * 6 })

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const a = anim.current
    a.phase += delta

    const dx = playerPosition.x - position[0]
    const dz = playerPosition.z - position[2]
    const inRange = dx * dx + dz * dz < INTERACT_RADIUS * INTERACT_RADIUS
    a.near += ((inRange ? 1 : 0) - a.near) * Math.min(1, delta * 9)

    if (crystal.current) {
      crystal.current.rotation.y += delta * (0.8 + a.near * 1.6)
      crystal.current.position.y = 1.6 + Math.sin(a.phase * 1.7) * 0.12 + a.near * 0.15
    }
    if (ringRef.current) {
      ringRef.current.material.opacity = 0.18 + a.near * 0.45
    }
  })

  // The same coursed stone the podiums stand on, so the two rows of props in
  // the hub are built out of one material.
  const baseMaterial = useMemo(
    () =>
      voxelMaterial('#e7ecf3', {
        pattern: 'bricks',
        cells: 4,
        variance: 0.07,
        fleckDepth: 0.16,
        repeat: [2, 1],
        roughness: 0.85,
        seed: 61,
      }),
    []
  )
  useEffect(() => () => baseMaterial.dispose(), [baseMaterial])

  const tint = achieved ? '#c9a3ff' : ready ? '#fbbf24' : '#64748b'

  return (
    <group
      position={position}
      // onClick, not onPointerDown: a mouse drag that starts here is the
      // camera orbit, and must not also trigger the prop.
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
    >
      <mesh material={baseMaterial} position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.8, 2.4]} />
      </mesh>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[2, 0.24, 2]} />
        <meshStandardMaterial color={tint} roughness={0.5} flatShading />
      </mesh>

      <mesh ref={ringRef} position={[0, 1.04, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.05, 1.4, 20]} />
        <meshBasicMaterial
          color={tint}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      {/* Floating crystal marking the milestone */}
      <mesh ref={crystal} position={[0, 1.6, 0]} castShadow>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial
          color={tint}
          emissive={tint}
          emissiveIntensity={achieved ? 0.7 : 0.25}
          roughness={0.3}
          flatShading
        />
      </mesh>

      <Billboard position={[0, 3.4, 0]}>
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[2.3, 1.02]} />
          <meshBasicMaterial color="#0b1220" transparent opacity={0.82} fog={false} />
        </mesh>
        <Text
          position={[0, 0.3, 0]}
          fontSize={0.21}
          color={tint}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.026}
          outlineColor="#0b1220"
        >
          {`${pedestal.rebirths} Rebirth${pedestal.rebirths === 1 ? '' : 's'}`}
        </Text>
        <Text
          position={[0, 0.01, 0]}
          fontSize={0.185}
          color={achieved ? '#86efac' : '#e2e8f0'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.022}
          outlineColor="#0b1220"
        >
          {achieved ? 'CLAIMED' : pedestal.label}
        </Text>
        <Text
          position={[0, -0.3, 0]}
          fontSize={0.145}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.018}
          outlineColor="#0b1220"
        >
          {ready ? 'Tap to rebirth' : `${formatNumber(Math.max(0, REBIRTH_WINS_REQUIRED - totalWins))} wins to go`}
        </Text>
      </Billboard>
    </group>
  )
}

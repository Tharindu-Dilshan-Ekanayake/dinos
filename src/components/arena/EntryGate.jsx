import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { ARENA, ENTRY_TRIGGER, chamberOrigin } from '../../data/arena.js'
import { formatNumber } from '../../data/progression.js'
import { useGameStore } from '../../store/useGameStore.js'
import { playerPosition } from '../../systems/playerState.js'

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

  const frameMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#4a3f35', roughness: 0.9 }),
    []
  )
  useEffect(() => () => frameMaterial.dispose(), [frameMaterial])

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
      {/* Low kerbs either side, no lintel. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          material={frameMaterial}
          position={[side * (ARENA.gapHalfWidth + 0.5), HEIGHT / 2, 0]}
          castShadow
        >
          <boxGeometry args={[1, HEIGHT, 1.4]} />
        </mesh>
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

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { RETURN_PADS, RETURN_PAD_RADIUS, chamberOrigin } from '../../data/arena.js'
import { formatNumber } from '../../data/progression.js'
import { useGameStore } from '../../store/useGameStore.js'
import { playerPosition } from '../../systems/playerState.js'

/**
 * Cash-out pads at the end of a cleared level.
 *
 * Stepping on one banks every Win carried this run and walks you back to the
 * hub. They are the safe half of the decision the end of a chamber poses: take
 * what you have, or push through the gate and risk losing it all to a level
 * that is too strong.
 */
export default function ReturnPads() {
  const stageIndex = useGameStore((s) => s.stageIndex)
  const stageCleared = useGameStore((s) => s.stageCleared)
  const runWins = useGameStore((s) => s.runWins)
  const dead = useGameStore((s) => s.dead)

  const group = useRef()
  const padRefs = useRef([])
  const armed = useRef(false)
  const anim = useRef({ show: 0, phase: 0 })

  const materials = useMemo(
    () => ({
      base: new THREE.MeshStandardMaterial({ color: '#2f5fb8', roughness: 0.7 }),
      top: new THREE.MeshStandardMaterial({
        color: '#ffc93c',
        emissive: '#ff9e00',
        emissiveIntensity: 0.4,
        roughness: 0.5,
      }),
    }),
    []
  )
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

  // Re-arm each time the pads appear, so arriving on top of one does not
  // instantly bank the run.
  useEffect(() => {
    armed.current = false
  }, [stageCleared, stageIndex])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const a = anim.current
    a.phase += delta

    const target = stageCleared && !dead ? 1 : 0
    a.show += (target - a.show) * Math.min(1, delta * 5)

    if (group.current) {
      group.current.visible = a.show > 0.02
      group.current.scale.setScalar(Math.max(0.001, a.show))
    }
    padRefs.current.forEach((pad, i) => {
      if (pad) pad.position.y = 0.26 + Math.sin(a.phase * 2.2 + i) * 0.05
    })

    if (!stageCleared || dead) return

    // Nearest pad wins; both do the same thing.
    const origin = chamberOrigin(stageIndex)
    let inside = false
    for (const pad of RETURN_PADS) {
      const distance = Math.hypot(
        playerPosition.x - pad.position[0],
        playerPosition.z - (origin + pad.position[2])
      )
      if (distance <= RETURN_PAD_RADIUS) inside = true
    }

    if (!inside) armed.current = true
    if (inside && armed.current) {
      armed.current = false
      useGameStore.getState().claimRunWins()
    }
  })

  return (
    <group ref={group} visible={false} position={[0, 0, chamberOrigin(stageIndex)]}>
      {RETURN_PADS.map((pad, i) => (
        <group key={pad.id} position={pad.position}>
          <mesh material={materials.base} position={[0, 0.12, 0]} receiveShadow castShadow>
            <boxGeometry args={[RETURN_PAD_RADIUS * 2, 0.24, RETURN_PAD_RADIUS * 2]} />
          </mesh>
          <mesh
            ref={(el) => {
              padRefs.current[i] = el
            }}
            material={materials.top}
            position={[0, 0.26, 0]}
          >
            <boxGeometry args={[RETURN_PAD_RADIUS * 1.5, 0.12, RETURN_PAD_RADIUS * 1.5]} />
          </mesh>

          <Billboard position={[0, 2.5, 0]}>
            <Text
              position={[0, 0.34, 0]}
              fontSize={0.44}
              color="#ffd166"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.055}
              outlineColor="#12100e"
            >
              {`+${formatNumber(runWins)} Wins`}
            </Text>
            <Text
              position={[0, -0.22, 0]}
              fontSize={0.38}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.05}
              outlineColor="#12100e"
            >
              Return
            </Text>
          </Billboard>
        </group>
      ))}
    </group>
  )
}

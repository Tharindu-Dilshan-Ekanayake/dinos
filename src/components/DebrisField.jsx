import { useEffect, useMemo, useRef, useState } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { AREAS } from '../data/areas.js'
import { useGameStore } from '../store/useGameStore.js'
import { EVENTS, on } from '../systems/events.js'
import { lastImpact } from '../systems/arenaEnemies.js'

/**
 * Rapier-driven chunks thrown off when an enemy dies.
 *
 * Physics is deliberately scoped to this one effect. Stage clears happen every
 * few seconds at most, so the body count stays bounded - whereas routing the
 * per-click sparks through rigid bodies would mean spawning hundreds of them a
 * second through React reconciliation.
 */
const CHUNKS_PER_BURST = 10
const BOSS_CHUNKS = 18
const LIFETIME_MS = 3200
const MAX_BATCHES = 2

let nextId = 0

function makeChunks(count) {
  const chunks = []
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 4 + Math.random() * 7
    chunks.push({
      key: i,
      offset: [
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.8,
      ],
      velocity: [
        Math.cos(angle) * speed * 0.7,
        4 + Math.random() * 7,
        Math.sin(angle) * speed * 0.7,
      ],
      spin: [
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
      ],
      scale: 0.13 + Math.random() * 0.16,
    })
  }
  return chunks
}

export default function DebrisField() {
  const areaIndex = useGameStore((s) => s.areaIndex)
  const area = AREAS[areaIndex] ?? AREAS[0]
  const [batches, setBatches] = useState([])
  const timers = useRef([])

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const materials = useMemo(
    () => ({
      normal: new THREE.MeshStandardMaterial({ color: area.enemy, roughness: 0.55 }),
      boss: new THREE.MeshStandardMaterial({
        color: '#ffb703',
        emissive: '#ff8500',
        emissiveIntensity: 0.5,
        roughness: 0.35,
      }),
    }),
    [area]
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      Object.values(materials).forEach((m) => m.dispose())
    }
  }, [geometry, materials])

  useEffect(() => {
    const unsubscribe = on(EVENTS.STAGE_CLEAR, ({ boss }) => {
      const id = nextId++
      const batch = { id, boss, chunks: makeChunks(boss ? BOSS_CHUNKS : CHUNKS_PER_BURST) }
      setBatches((prev) => [...prev.slice(-(MAX_BATCHES - 1)), batch])

      const timer = setTimeout(() => {
        setBatches((prev) => prev.filter((b) => b.id !== id))
        timers.current = timers.current.filter((t) => t !== timer)
      }, LIFETIME_MS)
      timers.current.push(timer)
    })

    return () => {
      unsubscribe()
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [])

  return (
    <>
      {/* Floor for the debris to land on. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[40, 1, 40]} position={[0, -1, 0]} />
      </RigidBody>

      {batches.map((batch) => (
        <group key={batch.id}>
          {batch.chunks.map((chunk) => (
            <RigidBody
              key={chunk.key}
              position={[
                lastImpact.x + chunk.offset[0],
                lastImpact.y + chunk.offset[1],
                lastImpact.z + chunk.offset[2],
              ]}
              linearVelocity={chunk.velocity}
              angularVelocity={chunk.spin}
              colliders="cuboid"
              restitution={0.42}
              friction={0.8}
            >
              <mesh
                geometry={geometry}
                material={batch.boss ? materials.boss : materials.normal}
                scale={chunk.scale}
                castShadow
              />
            </RigidBody>
          ))}
        </group>
      ))}
    </>
  )
}

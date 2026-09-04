import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { EVENTS, on } from '../systems/events.js'
import { getTimeScale } from '../systems/timeScale.js'
import { lastImpact } from '../systems/arenaEnemies.js'
import { playerPosition } from '../systems/playerState.js'

/**
 * Fixed-capacity instanced particle system.
 *
 * A clicker gets hammered - dozens of bursts a second - so this is one
 * InstancedMesh with a ring-buffer pool. Spawning never allocates, never
 * touches React, and the cost per frame is bounded by POOL_SIZE regardless of
 * how fast the player taps.
 */
const POOL_SIZE = 420
const GRAVITY = -14

const CLICK_COLOR = new THREE.Color('#ffe066')
const CRIT_COLOR = new THREE.Color('#ff5d8f')
const CLEAR_COLOR = new THREE.Color('#7cf7ff')
const BOSS_COLOR = new THREE.Color('#ffb703')

export default function HitParticles() {
  const meshRef = useRef()

  // Struct-of-arrays pool. Index `cursor` is the next slot to overwrite.
  const pool = useMemo(() => {
    const size = POOL_SIZE
    return {
      cursor: 0,
      position: new Float32Array(size * 3),
      velocity: new Float32Array(size * 3),
      life: new Float32Array(size),
      maxLife: new Float32Array(size),
      size: new Float32Array(size),
      spin: new Float32Array(size),
      alive: 0,
    }
  }, [])

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      quat: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      pos: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      color: new THREE.Color(),
    }),
    []
  )

  /**
   * Emit `count` particles from `origin`, which may be a [x, y, z] tuple or a
   * live THREE.Vector3 (the moving impact point, the player).
   */
  const burst = useMemo(() => {
    return (origin, { count, speed, spread, color, size, life, upward = 0.5 }) => {
      const mesh = meshRef.current
      if (!mesh) return

      const ox = origin.x ?? origin[0]
      const oy = origin.y ?? origin[1]
      const oz = origin.z ?? origin[2]

      for (let i = 0; i < count; i++) {
        const idx = pool.cursor
        pool.cursor = (pool.cursor + 1) % POOL_SIZE

        const i3 = idx * 3
        pool.position[i3] = ox + (Math.random() - 0.5) * spread
        pool.position[i3 + 1] = oy + (Math.random() - 0.5) * spread
        pool.position[i3 + 2] = oz + (Math.random() - 0.5) * spread

        // Cone biased away from the enemy and upward.
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const s = speed * (0.45 + Math.random() * 0.75)
        pool.velocity[i3] = Math.sin(phi) * Math.cos(theta) * s
        pool.velocity[i3 + 1] = Math.abs(Math.cos(phi)) * s * upward + s * 0.35
        pool.velocity[i3 + 2] = Math.sin(phi) * Math.sin(theta) * s

        const l = life * (0.7 + Math.random() * 0.6)
        pool.life[idx] = l
        pool.maxLife[idx] = l
        pool.size[idx] = size * (0.6 + Math.random() * 0.8)
        pool.spin[idx] = (Math.random() - 0.5) * 14

        scratch.color.copy(color).offsetHSL((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.15)
        mesh.setColorAt(idx, scratch.color)
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }, [pool, scratch])

  // Start every instance collapsed so nothing shows before the first burst.
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    scratch.matrix.makeScale(0, 0, 0)
    for (let i = 0; i < POOL_SIZE; i++) {
      mesh.setMatrixAt(i, scratch.matrix)
      mesh.setColorAt(i, CLICK_COLOR)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [scratch])

  useEffect(() => {
    const unsubscribers = [
      on(EVENTS.HIT, ({ crit, source, point, damage, maxHealth }) => {
        if (source !== 'click') return
        const origin = point ?? lastImpact
        const share = maxHealth > 0 ? Math.min(1, damage / maxHealth) : 0.2
        burst(origin, {
          count: crit ? 18 : 9 + Math.round(share * 8),
          speed: crit ? 7.5 : 5.4,
          spread: 0.35,
          color: crit ? CRIT_COLOR : CLICK_COLOR,
          size: crit ? 0.15 : 0.11,
          life: 0.55,
        })
      }),
      on(EVENTS.STAGE_CLEAR, ({ boss }) => {
        burst(lastImpact, {
          count: boss ? 90 : 46,
          speed: boss ? 11 : 8,
          spread: 0.9,
          color: boss ? BOSS_COLOR : CLEAR_COLOR,
          size: boss ? 0.2 : 0.15,
          life: 1.1,
          upward: 0.9,
        })
      }),
      on(EVENTS.EVOLVE, () => {
        burst(playerPosition, {
          count: 80,
          speed: 7,
          spread: 1.1,
          color: new THREE.Color('#ffd166'),
          size: 0.17,
          life: 1.2,
          upward: 1.1,
        })
      }),
      on(EVENTS.REBIRTH, () => {
        burst(playerPosition, {
          count: 120,
          speed: 12,
          spread: 1.4,
          color: new THREE.Color('#c9a3ff'),
          size: 0.2,
          life: 1.6,
          upward: 1.2,
        })
      }),
    ]
    return () => unsubscribers.forEach((off) => off())
  }, [burst])

  useFrame((_, rawDelta) => {
    const mesh = meshRef.current
    if (!mesh) return
    // Particles obey the hit-stop, which is what makes the freeze read as
    // impact rather than a dropped frame.
    const delta = Math.min(rawDelta, 0.05) * getTimeScale()
    if (delta <= 0) return

    let anyAlive = false
    for (let i = 0; i < POOL_SIZE; i++) {
      if (pool.life[i] <= 0) continue
      anyAlive = true

      pool.life[i] -= delta
      const i3 = i * 3

      if (pool.life[i] <= 0) {
        scratch.matrix.makeScale(0, 0, 0)
        mesh.setMatrixAt(i, scratch.matrix)
        continue
      }

      pool.velocity[i3 + 1] += GRAVITY * delta
      pool.position[i3] += pool.velocity[i3] * delta
      pool.position[i3 + 1] += pool.velocity[i3 + 1] * delta
      pool.position[i3 + 2] += pool.velocity[i3 + 2] * delta

      // Bounce once off the floor so debris settles instead of sinking.
      if (pool.position[i3 + 1] < 0.06 && pool.velocity[i3 + 1] < 0) {
        pool.position[i3 + 1] = 0.06
        pool.velocity[i3 + 1] *= -0.36
        pool.velocity[i3] *= 0.7
        pool.velocity[i3 + 2] *= 0.7
      }

      const t = pool.life[i] / pool.maxLife[i]
      // Shrink toward nothing so particles fade without needing per-instance alpha.
      const scale = pool.size[i] * (0.25 + t * 0.75) * (1 + (1 - t) * 0.3)

      scratch.pos.set(pool.position[i3], pool.position[i3 + 1], pool.position[i3 + 2])
      scratch.euler.set(pool.spin[i] * (1 - t), pool.spin[i] * (1 - t) * 0.7, 0)
      scratch.quat.setFromEuler(scratch.euler)
      scratch.scale.setScalar(scale)
      scratch.matrix.compose(scratch.pos, scratch.quat, scratch.scale)
      mesh.setMatrixAt(i, scratch.matrix)
    }

    if (anyAlive) mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, POOL_SIZE]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial toneMapped={false} fog={false} />
    </instancedMesh>
  )
}

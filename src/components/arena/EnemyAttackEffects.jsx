import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { EVENTS, on } from '../../systems/events.js'
import { getTimeScale } from '../../systems/timeScale.js'

/**
 * What an enemy's attack looks like.
 *
 * The pack fought entirely in numbers before this - your health went down and
 * nothing on screen said which of the five did it or how. A sailback's fire
 * reaches twice as far as a runner's teeth, and that is only a real difference
 * if you can see it coming out of the sailback.
 *
 * One instanced mesh for every effect in the level. Blows land several times a
 * second across a pack of seven, so this is a fixed pool written matrix by
 * matrix each frame - no allocation, no React, and nothing to garbage collect
 * in the middle of a fight.
 */

/** Plenty for a pack of seven mid-flurry; the oldest is recycled beyond it. */
const POOL = 90

/** Pieces fade toward this as they burn out, so a plume reads as heat. */
const WHITE = new THREE.Color('#ffffff')

/** How each tell throws its pieces. */
const TELLS = {
  // A jet, thrown along the ground from the mouth toward the dino.
  breath: { count: 14, life: 0.5, speed: 9, spread: 0.34, rise: 1.1, size: 0.5, grow: 1.9 },
  // A short jab: a few pieces punched forward and gone.
  lunge: { count: 6, life: 0.26, speed: 11, spread: 0.18, rise: 1.2, size: 0.34, grow: 0.7 },
  // Thrown wide, because a tail comes round rather than straight in.
  sweep: { count: 9, life: 0.3, speed: 8, spread: 1.15, rise: 0.9, size: 0.32, grow: 0.8 },
  // Straight up off the ground, where the weight landed.
  stomp: { count: 10, life: 0.36, speed: 5, spread: 2.6, rise: 0.2, size: 0.38, grow: 0.9 },
}

export default function EnemyAttackEffects() {
  const meshRef = useRef()

  const pieces = useMemo(
    () =>
      Array.from({ length: POOL }, () => ({
        life: 0,
        span: 1,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 0.3,
        grow: 1,
        spin: 0,
        color: new THREE.Color(),
      })),
    []
  )
  const next = useRef(0)

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      scale: new THREE.Vector3(),
      color: new THREE.Color(),
    }),
    []
  )

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  )

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material]
  )

  useEffect(
    () =>
      on(EVENTS.ENEMY_ATTACK, ({ tell, color, from, to, boss }) => {
        const spec = TELLS[tell] ?? TELLS.lunge
        // Which way the blow is thrown: from the enemy toward the dino.
        const dx = to[0] - from[0]
        const dz = to[1] - from[1]
        const length = Math.hypot(dx, dz) || 1
        const ux = dx / length
        const uz = dz / length
        const scale = boss ? 1.5 : 1

        for (let i = 0; i < spec.count; i++) {
          const piece = pieces[next.current]
          next.current = (next.current + 1) % POOL

          // Fan the throw out around the aim, by however wide this tell is.
          const spread = (Math.random() - 0.5) * spec.spread
          const cos = Math.cos(spread)
          const sin = Math.sin(spread)
          const speed = spec.speed * (0.55 + Math.random() * 0.7) * scale

          piece.life = 1
          piece.span = spec.life * (0.75 + Math.random() * 0.5)
          piece.x = from[0] + ux * 0.5
          piece.y = spec.rise * scale * (0.7 + Math.random() * 0.6)
          piece.z = from[1] + uz * 0.5
          piece.vx = (ux * cos - uz * sin) * speed
          piece.vz = (uz * cos + ux * sin) * speed
          piece.vy = (tell === 'stomp' ? 5.5 : 1.4) * (0.4 + Math.random())
          piece.size = spec.size * scale * (0.7 + Math.random() * 0.6)
          piece.grow = spec.grow
          piece.spin = Math.random() * Math.PI
          piece.color.set(color)
        }
      }),
    [pieces]
  )

  useFrame((_, rawDelta) => {
    const mesh = meshRef.current
    if (!mesh) return

    const delta = Math.min(rawDelta, 0.05) * getTimeScale()
    let live = 0

    for (let i = 0; i < POOL; i++) {
      const piece = pieces[i]
      if (piece.life <= 0) {
        // Parked out of sight rather than skipped - an instanced mesh draws
        // every slot it has, so a stale matrix is a box frozen mid-air.
        scratch.position.set(0, -1000, 0)
        scratch.scale.set(0.0001, 0.0001, 0.0001)
        scratch.quaternion.identity()
        scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale)
        mesh.setMatrixAt(i, scratch.matrix)
        continue
      }

      piece.life -= delta / piece.span
      if (piece.life < 0) piece.life = 0
      live++

      piece.x += piece.vx * delta
      piece.y += piece.vy * delta
      piece.z += piece.vz * delta
      piece.vy -= 9 * delta
      // Drag, so a jet slows into a cloud rather than flying off the map.
      piece.vx *= 1 - Math.min(1, delta * 3.2)
      piece.vz *= 1 - Math.min(1, delta * 3.2)
      if (piece.y < 0.05) {
        piece.y = 0.05
        piece.vy = 0
      }

      const age = 1 - piece.life
      const size = piece.size * (1 + age * piece.grow) * piece.life
      scratch.position.set(piece.x, piece.y, piece.z)
      scratch.euler.set(piece.spin * age, piece.spin, piece.spin * age * 0.5)
      scratch.quaternion.setFromEuler(scratch.euler)
      scratch.scale.set(size, size, size)
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale)
      mesh.setMatrixAt(i, scratch.matrix)
      // Fading toward white as it burns out, which is what makes a plume read
      // as heat rather than as coloured confetti.
      scratch.color.copy(piece.color).lerp(WHITE, age * 0.55)
      mesh.setColorAt(i, scratch.color)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.visible = live > 0
  })

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, POOL]} frustumCulled={false} />
  )
}

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const COUNT = 32
const HALF_WIDTH = 4.2
const HALF_DEPTH = 2
const HEIGHT = 8

/**
 * A handful of motes drifting up through the doorway - ambient dressing for
 * the one threshold in the hub the whole layout points toward.
 *
 * Deliberately not the pooled emitter HitParticles.jsx uses: nothing ever
 * triggers these, so there is no event to catch and no burst to size a pool
 * for. A small, always-alive field that loops its own height is simpler and
 * exactly as cheap - one InstancedMesh, one static geometry, thirty-two
 * matrices rewritten from a small per-particle seed table each frame.
 */
export default function PortalParticles({ color = '#bdf0ff' }) {
  const meshRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        // Reads as a mote of light rather than a lit speck of dust.
        toneMapped: false,
        fog: false,
      }),
    [color]
  )
  const geometry = useMemo(() => new THREE.OctahedronGeometry(0.09, 0), [])

  useEffect(
    () => () => {
      material.dispose()
      geometry.dispose()
    },
    [material, geometry]
  )

  const seeds = useMemo(() => {
    let seed = 4242
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    return Array.from({ length: COUNT }, () => ({
      x: (rand() - 0.5) * HALF_WIDTH * 2,
      z: (rand() - 0.5) * HALF_DEPTH * 2,
      speed: 0.35 + rand() * 0.4,
      offset: rand() * HEIGHT,
      wobble: rand() * Math.PI * 2,
      scale: 0.6 + rand() * 0.7,
    }))
  }, [])

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return
    const t = state.clock.elapsedTime

    seeds.forEach((p, i) => {
      const y = (p.offset + t * p.speed) % HEIGHT
      // Fades in off the ground and out again near the top, rather than
      // popping into existence and cutting off when a particle loops.
      const life = y / HEIGHT
      const fade = Math.sin(life * Math.PI)

      dummy.position.set(p.x + Math.sin(t * 0.6 + p.wobble) * 0.3, y, p.z)
      dummy.scale.setScalar(p.scale * fade)
      dummy.rotation.set(t * 0.5, t * 0.7, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })

    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, COUNT]}
      // The whole field lives inside one small, fixed volume around the
      // doorway - cheaper to always draw it than to recompute a bounding
      // sphere for it every frame as the motes drift inside that volume.
      frustumCulled={false}
    />
  )
}

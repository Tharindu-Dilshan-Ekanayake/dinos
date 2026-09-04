import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { playerPosition } from '../../systems/playerState.js'

/**
 * The weather in a chamber: rain, snow, drifting leaves, rising embers.
 *
 * One InstancedMesh of little voxel cubes, sized once to the heaviest storm in
 * the game and then flown at whatever count the current stage calls for. The
 * pool never reallocates, so walking from a downpour into clear sky costs
 * nothing but a changing count.
 *
 * Particles are stored *relative to the player* and offset when their matrix is
 * written, which means the field always surrounds you without ever having to be
 * re-centred, and a particle that falls out of the bottom simply reappears at
 * the top.
 */

/** Sized to the heaviest weather in data/weather.js, with room to spare. */
const MAX_PARTICLES = 520

/** The volume the weather occupies around the player. */
const FIELD_RADIUS = 22
const FIELD_HEIGHT = 26

/** Seconds for one weather to give way to the next. */
const FADE_SECONDS = 2.5

export default function Weather({ weather }) {
  const meshRef = useRef()

  // Struct-of-arrays pool, seeded once and then recycled forever.
  const pool = useMemo(() => {
    const position = new Float32Array(MAX_PARTICLES * 3)
    const phase = new Float32Array(MAX_PARTICLES)
    const rate = new Float32Array(MAX_PARTICLES)
    const spin = new Float32Array(MAX_PARTICLES)

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const i3 = i * 3
      position[i3] = (Math.random() - 0.5) * 2 * FIELD_RADIUS
      position[i3 + 1] = Math.random() * FIELD_HEIGHT
      position[i3 + 2] = (Math.random() - 0.5) * 2 * FIELD_RADIUS
      phase[i] = Math.random() * Math.PI * 2
      // Per-particle speed spread, so a shower has depth rather than falling
      // as one sheet.
      rate[i] = 0.75 + Math.random() * 0.5
      spin[i] = Math.random() * Math.PI * 2
    }

    return { position, phase, rate, spin }
  }, [])

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      quaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      color: new THREE.Color(),
    }),
    []
  )

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])

  /*
   * Two materials rather than one whose blending is switched: changing a
   * material's blend mode forces a shader recompile, which would hitch the
   * frame you walk into a new stage.
   */
  const materials = useMemo(
    () => ({
      solid: new THREE.MeshBasicMaterial({ transparent: true, fog: false, toneMapped: false }),
      glow: new THREE.MeshBasicMaterial({
        transparent: true,
        fog: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    }),
    []
  )

  useEffect(
    () => () => {
      geometry.dispose()
      Object.values(materials).forEach((m) => m.dispose())
    },
    [geometry, materials]
  )

  /** Eased count and opacity, so weather arrives and leaves rather than snaps. */
  const live = useRef({ count: 0, opacity: 0 })

  useFrame((state, rawDelta) => {
    const mesh = meshRef.current
    if (!mesh) return

    const delta = Math.min(rawDelta, 0.05)
    const time = state.clock.elapsedTime
    const target = weather ?? { count: 0 }

    const ease = Math.min(1, delta / FADE_SECONDS)
    live.current.count += ((target.count ?? 0) - live.current.count) * ease
    live.current.opacity += ((target.opacity ?? 0) - live.current.opacity) * ease

    const count = Math.round(live.current.count)
    if (count < 1) {
      mesh.visible = false
      return
    }

    mesh.visible = true
    mesh.count = Math.min(count, MAX_PARTICLES)
    mesh.material = target.glow ? materials.glow : materials.solid
    mesh.material.color.set(target.color ?? '#ffffff')
    mesh.material.opacity = live.current.opacity

    const size = target.size ?? [0.1, 0.1, 0.1]
    const rising = target.rising ? 1 : -1
    const speed = target.speed ?? 1
    const drift = target.drift ?? 0
    const spin = target.spin ?? 0
    const tilt = target.tilt ?? 0

    scratch.scale.set(size[0], size[1], size[2])

    for (let i = 0; i < mesh.count; i++) {
      const i3 = i * 3
      const p = pool.position

      p[i3 + 1] += rising * speed * pool.rate[i] * delta
      // Wind is a slow wander, not a straight line - each particle runs on its
      // own phase so a shower never looks like a marching grid.
      p[i3] += Math.sin(time * 1.3 + pool.phase[i]) * drift * delta
      p[i3 + 2] += Math.cos(time * 1.1 + pool.phase[i] * 1.4) * drift * delta

      // Recycle through the far face of the volume.
      if (rising < 0 && p[i3 + 1] < 0) {
        p[i3 + 1] = FIELD_HEIGHT
        p[i3] = (Math.random() - 0.5) * 2 * FIELD_RADIUS
        p[i3 + 2] = (Math.random() - 0.5) * 2 * FIELD_RADIUS
      } else if (rising > 0 && p[i3 + 1] > FIELD_HEIGHT) {
        p[i3 + 1] = 0
        p[i3] = (Math.random() - 0.5) * 2 * FIELD_RADIUS
        p[i3 + 2] = (Math.random() - 0.5) * 2 * FIELD_RADIUS
      }
      if (p[i3] > FIELD_RADIUS) p[i3] -= FIELD_RADIUS * 2
      else if (p[i3] < -FIELD_RADIUS) p[i3] += FIELD_RADIUS * 2
      if (p[i3 + 2] > FIELD_RADIUS) p[i3 + 2] -= FIELD_RADIUS * 2
      else if (p[i3 + 2] < -FIELD_RADIUS) p[i3 + 2] += FIELD_RADIUS * 2

      scratch.position.set(
        playerPosition.x + p[i3],
        p[i3 + 1],
        playerPosition.z + p[i3 + 2]
      )
      // Rain leans with the wind; leaves and ash tumble.
      scratch.euler.set(
        spin ? time * spin + pool.spin[i] : 0,
        spin ? time * spin * 0.6 + pool.spin[i] : 0,
        tilt
      )
      scratch.quaternion.setFromEuler(scratch.euler)
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale)
      mesh.setMatrixAt(i, scratch.matrix)
    }

    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, MAX_PARTICLES]}
      // Particles are placed around the live player position, so the bounding
      // sphere computed at mount would be stale the moment anyone moves.
      frustumCulled={false}
    />
  )
}

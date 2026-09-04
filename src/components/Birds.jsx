import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { playerPosition } from '../systems/playerState.js'

/**
 * Birds circling high over the level.
 *
 * Two loose flocks drifting round the player on long slow arcs, wings beating.
 * They cost three instanced meshes and about forty matrices a frame, and they
 * do more for the feeling that this is a *place* than anything else of that
 * price - a sky with something alive in it stops reading as a painted dome.
 *
 * They clear off in heavy weather, which is the detail that sells them: no
 * birds are out in a blizzard.
 */

const FLOCKS = 2
const PER_FLOCK = 7
const COUNT = FLOCKS * PER_FLOCK

/** Seconds a flock takes to come all the way round. */
const ORBIT_SECONDS = 78

export default function Birds({ color = '#3d4657', hidden = false }) {
  const bodyRef = useRef()
  const wingRef = useRef()

  // Fixed per-bird character: where it sits in its flock, and its own wingbeat.
  const flock = useMemo(() => {
    let seed = 24601
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }

    return Array.from({ length: COUNT }, (_, i) => {
      const group = Math.floor(i / PER_FLOCK)
      return {
        // Flocks start on opposite sides and fly at different heights.
        phase: group * Math.PI + (rand() - 0.5) * 0.7,
        /*
         * Low and far out, because the orbit camera always looks slightly
         * *down* at the dino - it never tilts up. Anything higher than about
         * a tenth of its distance sits above the top of the frame and may as
         * well not exist. This puts the flocks on the skyline instead.
         */
        radius: 45 + group * 12 + rand() * 12,
        height: 13 + group * 4 + rand() * 4,
        // Slight lag around the arc so a flock strings out rather than
        // flying in a rigid ring.
        trail: rand() * 0.28,
        beat: 7 + rand() * 3,
        beatPhase: rand() * Math.PI * 2,
        scale: 0.8 + rand() * 0.5,
      }
    })
  }, [])

  const geometries = useMemo(
    () => ({
      body: new THREE.BoxGeometry(1.5, 0.42, 0.6),
      wing: new THREE.BoxGeometry(0.7, 0.14, 2.1),
    }),
    []
  )

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        fog: false,
        transparent: true,
        opacity: 0.85,
      }),
    [color]
  )

  useEffect(
    () => () => {
      Object.values(geometries).forEach((g) => g.dispose())
      material.dispose()
    },
    [geometries, material]
  )

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      offset: new THREE.Matrix4(),
      quaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(),
    }),
    []
  )

  /** Eased so a flock fades away as the weather closes in rather than blinking out. */
  const shown = useRef(0)

  useFrame((state, rawDelta) => {
    const bodies = bodyRef.current
    const wings = wingRef.current
    if (!bodies || !wings) return

    const delta = Math.min(rawDelta, 0.05)
    const time = state.clock.elapsedTime

    shown.current += ((hidden ? 0 : 1) - shown.current) * Math.min(1, delta * 0.6)
    if (shown.current < 0.02) {
      bodies.visible = false
      wings.visible = false
      return
    }
    bodies.visible = true
    wings.visible = true
    material.opacity = 0.85 * shown.current

    for (let i = 0; i < COUNT; i++) {
      const bird = flock[i]
      const angle = bird.phase + (time / ORBIT_SECONDS) * Math.PI * 2 - bird.trail

      scratch.position.set(
        playerPosition.x + Math.cos(angle) * bird.radius,
        // A slow rise and fall over the circuit, so the flock is not on rails.
        bird.height + Math.sin(angle * 2 + bird.phase) * 3,
        playerPosition.z + Math.sin(angle) * bird.radius
      )
      // Nose along the direction of travel.
      scratch.euler.set(0, -angle + Math.PI / 2, 0)
      scratch.quaternion.setFromEuler(scratch.euler)
      scratch.scale.setScalar(bird.scale)
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale)
      bodies.setMatrixAt(i, scratch.matrix)

      const flap = Math.sin(time * bird.beat + bird.beatPhase) * 0.85
      for (const side of [0, 1]) {
        const sign = side === 0 ? -1 : 1
        scratch.euler.set(sign * flap, -angle + Math.PI / 2, 0)
        scratch.quaternion.setFromEuler(scratch.euler)
        // Hung off the body's shoulder, so the beat pivots at the root.
        scratch.position.set(
          playerPosition.x + Math.cos(angle) * bird.radius,
          bird.height + Math.sin(angle * 2 + bird.phase) * 3,
          playerPosition.z + Math.sin(angle) * bird.radius
        )
        scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale)
        // Offset the wing along its own local Z once the rotation is applied.
        scratch.offset.makeTranslation(0, 0.06, sign * 1.1)
        scratch.matrix.multiply(scratch.offset)
        wings.setMatrixAt(i * 2 + side, scratch.matrix)
      }
    }

    bodies.instanceMatrix.needsUpdate = true
    wings.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      {/* Placed around the live player position, so a mount-time bounding
          sphere would be stale immediately. */}
      <instancedMesh
        ref={bodyRef}
        args={[geometries.body, material, COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={wingRef}
        args={[geometries.wing, material, COUNT * 2]}
        frustumCulled={false}
      />
    </>
  )
}

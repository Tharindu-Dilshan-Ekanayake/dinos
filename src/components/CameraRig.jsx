import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EVENTS, on } from '../systems/events.js'
import { getTimeScale, hitStop } from '../systems/timeScale.js'

/*
 * Framing: pulled back far enough to hold both fighters with headroom, and
 * aimed low so the action sits in the upper two thirds of the screen - the
 * bottom third belongs to the HUD, which on a phone is where the thumbs are.
 */
const BASE_POSITION = new THREE.Vector3(0, 3.1, 12.2)
const LOOK_AT = new THREE.Vector3(0, 0.95, 0)

/**
 * World-space width the shot must always contain: both fighters plus a margin.
 * On a portrait phone the horizontal field of view is far narrower than on a
 * desktop, so a fixed camera distance that frames the duel on a laptop pushes
 * both fighters off the sides of a phone. Deriving the distance from the
 * viewport aspect keeps the same framing everywhere.
 */
const REQUIRED_WIDTH = 13.5
/** Never sit closer than the tuned desktop framing. */
const MIN_DISTANCE = 12.2
const MAX_DISTANCE = 26

function distanceForAspect(camera) {
  const vFov = (camera.fov * Math.PI) / 180
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect)
  const needed = REQUIRED_WIDTH / 2 / Math.tan(hFov / 2)
  return Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, needed))
}

/** Trauma decays linearly; shake offset uses trauma^2 so small hits stay subtle. */
const TRAUMA_DECAY = 2.6
const MAX_TRAUMA = 1

export default function CameraRig() {
  const camera = useThree((s) => s.camera)
  const trauma = useRef(0)
  const time = useRef(0)
  const offset = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const unsubscribers = [
      on(EVENTS.HIT, ({ damage, crit, maxHealth, source }) => {
        // Idle ticks land constantly; only player clicks should move the camera.
        if (source !== 'click') return
        // Shake scales with how big a bite this hit took out of the enemy, so
        // a click that nearly kills feels heavier than chip damage.
        const share = maxHealth > 0 ? Math.min(1, damage / maxHealth) : 0.2
        const amount = 0.13 + share * 0.4 + (crit ? 0.18 : 0)
        trauma.current = Math.min(MAX_TRAUMA, trauma.current + amount)
        hitStop(crit ? 0.72 : 0.42, crit ? 0.075 : 0.045)
      }),
      on(EVENTS.STAGE_CLEAR, ({ boss }) => {
        trauma.current = Math.min(MAX_TRAUMA, trauma.current + (boss ? 0.95 : 0.5))
        hitStop(boss ? 0.85 : 0.6, boss ? 0.16 : 0.09)
      }),
      on(EVENTS.EVOLVE, () => {
        trauma.current = Math.min(MAX_TRAUMA, trauma.current + 0.7)
        hitStop(0.8, 0.14)
      }),
      on(EVENTS.REBIRTH, () => {
        trauma.current = MAX_TRAUMA
        hitStop(0.9, 0.22)
      }),
    ]
    return () => unsubscribers.forEach((off) => off())
  }, [])

  useFrame((_, rawDelta) => {
    // Re-derive the framing distance every frame: it is two trig calls, and it
    // means orientation changes and window resizes are handled for free.
    const distance = distanceForAspect(camera)

    // Shake runs on unscaled time: during a hit-stop the camera should still
    // vibrate, which is what sells the freeze as an impact rather than a stall.
    const delta = Math.min(rawDelta, 0.05)
    time.current += delta * 34

    trauma.current = Math.max(0, trauma.current - TRAUMA_DECAY * delta)
    const shake = trauma.current * trauma.current

    const t = time.current
    offset.set(
      Math.sin(t * 1.07) * shake * 0.38,
      Math.sin(t * 1.63 + 1.7) * shake * 0.3,
      Math.sin(t * 0.87 + 3.1) * shake * 0.18
    )

    // A slow breathing drift keeps the framing alive between clicks.
    const scaled = getTimeScale()
    const breathe = Math.sin(performance.now() * 0.00035) * 0.12 * scaled

    camera.position.set(
      BASE_POSITION.x + offset.x + breathe,
      BASE_POSITION.y + offset.y + (distance - MIN_DISTANCE) * 0.16,
      distance + offset.z
    )
    camera.lookAt(LOOK_AT)
    camera.rotation.z += Math.sin(t * 1.31) * shake * 0.035
  })

  return null
}

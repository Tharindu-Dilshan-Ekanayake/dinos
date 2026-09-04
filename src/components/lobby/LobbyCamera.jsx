import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { installCameraOrbit, orbit } from '../../systems/cameraOrbit.js'
import { playerPosition } from '../../systems/playerState.js'

/**
 * Third-person orbit camera.
 *
 * The mouse swings it around the player and the wheel zooms; it eases toward
 * its target so quick swings glide rather than snap. Walking is WASD only, and
 * the player controller resolves that input against this camera's angle.
 */
const LOOK_HEIGHT = 2.1

export default function LobbyCamera() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  const current = useRef(new THREE.Vector3(0, 10, 36))
  const desired = useRef(new THREE.Vector3())
  const lookAt = useRef(new THREE.Vector3(0, LOOK_HEIGHT, 0))
  const lookTarget = useRef(new THREE.Vector3())

  useEffect(() => installCameraOrbit(gl.domElement), [gl])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)

    const horizontal = Math.cos(orbit.pitch) * orbit.distance
    desired.current.set(
      playerPosition.x + Math.sin(orbit.yaw) * horizontal,
      playerPosition.y + Math.sin(orbit.pitch) * orbit.distance,
      playerPosition.z + Math.cos(orbit.yaw) * horizontal
    )

    // Frame-rate independent smoothing.
    current.current.lerp(desired.current, 1 - Math.pow(0.0008, delta))

    lookTarget.current.set(playerPosition.x, playerPosition.y + LOOK_HEIGHT, playerPosition.z)
    lookAt.current.lerp(lookTarget.current, 1 - Math.pow(0.0006, delta))

    camera.position.copy(current.current)
    camera.lookAt(lookAt.current)
  })

  return null
}

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { installCameraOrbit, orbit } from '../../systems/cameraOrbit.js'
import { consumeTeleport, playerPosition } from '../../systems/playerState.js'

/**
 * Third-person orbit camera.
 *
 * The mouse swings it around the player and the wheel zooms; it eases toward
 * its target so quick swings glide rather than snap. Walking is WASD only, and
 * the player controller resolves that input against this camera's angle.
 *
 * `clamp` is the scene's idea of where open space is. Without it a sideways
 * swing parks the camera inside a cliff or a wall, and because that geometry is
 * single-sided the camera sees straight through it: the wall disappears and
 * whatever stands on top of it is left hanging in the sky. Both the target and
 * the smoothed position are clamped, so the camera cannot cut a corner through
 * solid rock on its way either.
 */
const LOOK_HEIGHT = 2.1

/**
 * Steepest the shot is allowed to get, by default.
 *
 * A corridor has no room sideways, so a camera swung side-on in one gets
 * squeezed in until it is a few metres from the dino - and at that range the
 * orbit's eight metres of height is a near vertical view of your own back,
 * which is what every stage boundary used to look like. Height is the thing to
 * give up there: a camera with nowhere to stand back to comes down instead.
 *
 * A caller with more room to work with - see `maxLookDown` below - can raise
 * this; nothing that mounts this component without the prop changes at all.
 */
const MAX_LOOK_DOWN = 0.62

/**
 * A gap the camera cannot have walked into, in world units.
 *
 * The player moves at 8.5 a second and the frame loop caps delta at a
 * twentieth, so the target never advances more than about 0.43 in one step and
 * the smoothed position closes on it within a couple of units. Anything past
 * this is a scene change or a fresh mount, and both want a cut.
 */
const CUT_ABOVE = 8

export default function LobbyCamera({ clamp, worldOffset = [0, 0, 0], maxLookDown = MAX_LOOK_DOWN }) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  const current = useRef(new THREE.Vector3(0, 10, 36))
  const desired = useRef(new THREE.Vector3())
  const lookAt = useRef(new THREE.Vector3(0, LOOK_HEIGHT, 0))
  const lookTarget = useRef(new THREE.Vector3())
  const mounted = useRef(false)

  useEffect(() => installCameraOrbit(gl.domElement), [gl])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)

    const horizontal = Math.cos(orbit.pitch) * orbit.distance
    desired.current.set(
      playerPosition.x + Math.sin(orbit.yaw) * horizontal,
      playerPosition.y + Math.sin(orbit.pitch) * orbit.distance,
      playerPosition.z + Math.cos(orbit.yaw) * horizontal
    )
    desired.current.add(new THREE.Vector3(...worldOffset))

    if (clamp) clamp(desired.current)

    /*
     * A jump cut, not a fly-through.
     *
     * Easing is what makes a camera swing glide, and across a scene change it
     * is what made entering Stage 1 look like a cutscene: the dino arrived
     * ninety units down the corridor and the shot flew the whole way after it.
     *
     * Two things trigger the cut, and both are needed:
     *
     *  - Anything that *placed* the dino says so (`consumeTeleport`).
     *  - Any gap the camera could not possibly have walked into. The scenes
     *    each mount their *own* camera, whose smoothed position starts at a
     *    hardcoded default - and the outgoing scene's camera can consume the
     *    teleport flag on the same frame the crossing happens, leaving the
     *    incoming one to ease in from that default. The flag alone was
     *    therefore a coin toss on component ordering; a distance this large is
     *    proof on its own, because walking moves the target less than half a
     *    unit in the longest frame the loop allows.
     */
    const jumped = current.current.distanceTo(desired.current) > CUT_ABOVE
    if (!mounted.current || consumeTeleport() || jumped) {
      mounted.current = true
      current.current.copy(desired.current)
      lookAt.current.set(
        playerPosition.x + worldOffset[0],
        playerPosition.y + worldOffset[1] + LOOK_HEIGHT,
        playerPosition.z + worldOffset[2]
      )
    } else {
      // Frame-rate independent smoothing.
      current.current.lerp(desired.current, 1 - Math.pow(0.0008, delta))
    }
    if (clamp) clamp(current.current)

    /*
     * However close the clamp pulled it in, keep the shot readable. Capped
     * against the distance actually achieved rather than the one asked for, so
     * it eases down as the walls close in and back up as they open out.
     */
    const eye = playerPosition.y + worldOffset[1] + LOOK_HEIGHT
    const reach = Math.hypot(
      current.current.x - (playerPosition.x + worldOffset[0]),
      current.current.z - (playerPosition.z + worldOffset[2])
    )
    const ceiling = eye + reach * Math.tan(maxLookDown)
    if (current.current.y > ceiling) current.current.y = ceiling

    lookTarget.current.set(
      playerPosition.x + worldOffset[0],
      playerPosition.y + worldOffset[1] + LOOK_HEIGHT,
      playerPosition.z + worldOffset[2]
    )
    lookAt.current.lerp(lookTarget.current, 1 - Math.pow(0.0006, delta))

    camera.position.copy(current.current)
    camera.lookAt(lookAt.current)
  })

  return null
}

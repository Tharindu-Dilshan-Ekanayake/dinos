import { useLayoutEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LOBBY_PALETTE, PLAZA } from '../../data/lobby.js'
import GradientSky from '../GradientSky.jsx'

/**
 * Bright daytime lighting for the hub. Fixed colours - unlike the arena, the
 * lobby never changes theme, so nothing here needs a per-frame lerp.
 */
export default function LobbyEnvironment() {
  const scene = useThree((s) => s.scene)

  const colors = useMemo(
    () => ({
      top: new THREE.Color(LOBBY_PALETTE.skyTop),
      bottom: new THREE.Color(LOBBY_PALETTE.skyBottom),
    }),
    []
  )

  const fog = useMemo(
    () => new THREE.Fog(LOBBY_PALETTE.fog, LOBBY_PALETTE.fogNear, LOBBY_PALETTE.fogFar),
    []
  )

  useLayoutEffect(() => {
    const previous = scene.fog
    scene.fog = fog
    return () => {
      scene.fog = previous
    }
  }, [scene, fog])

  const centreZ = (PLAZA.from + PLAZA.to) / 2

  /*
   * A DirectionalLight aims at its `target` object, but three.js only updates
   * that object's world matrix if it is actually in the scene - so the target
   * is mounted explicitly rather than set through `target-position`.
   */
  const lightTarget = useMemo(() => new THREE.Object3D(), [])

  return (
    <>
      <ambientLight intensity={1.05} color={LOBBY_PALETTE.ambient} />
      <hemisphereLight intensity={0.5} color="#ffffff" groundColor={LOBBY_PALETTE.grassDark} />
      <directionalLight
        position={[18, 30, 22]}
        intensity={2}
        color={LOBBY_PALETTE.key}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-36}
        shadow-camera-right={36}
        shadow-camera-top={36}
        shadow-camera-bottom={-36}
        shadow-camera-near={1}
        shadow-camera-far={110}
        shadow-bias={-0.0006}
        target={lightTarget}
      />
      {/* Centres the shadow frustum on the plaza so the whole hub casts. */}
      <primitive object={lightTarget} position={[0, 0, centreZ]} />
      <directionalLight position={[-14, 10, -18]} intensity={0.45} color="#bcd9ff" />

      <GradientSky topColor={colors.top} bottomColor={colors.bottom} radius={110} offset={22} />
    </>
  )
}

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LOBBY_PALETTE, PLAZA } from '../../data/lobby.js'
import { playerPosition } from '../../systems/playerState.js'
import Birds from '../Birds.jsx'
import GradientSky from '../GradientSky.jsx'
import SkyBody from '../SkyBody.jsx'
import VoxelClouds from '../VoxelClouds.jsx'

/**
 * Bright daytime lighting for the hub. Fixed colours - unlike the arena, the
 * lobby never changes theme, so nothing here needs a per-frame lerp.
 */
/**
 * How much further out the sky sits than it used to, and where that puts it.
 *
 * One factor for the dome, the clouds and the sun together - move one without
 * the others and the horizon stops agreeing with itself.
 */
const SKY_SCALE = 2.4
const SKY_RADIUS = 100 * SKY_SCALE

export default function LobbyEnvironment() {
  const scene = useThree((s) => s.scene)
  const skyRef = useRef()

  /*
   * The sky rides with the player.
   *
   * Anchored at the world origin it does not fit inside the camera's far
   * plane once the player walks down the plaza, and the far side of the dome
   * gets clipped away - which shows as a hole punched in the sky.
   */
  useFrame(() => {
    if (skyRef.current) skyRef.current.position.set(playerPosition.x, 0, playerPosition.z)
  })

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

      {/*
        The dome has to contain the corridor the staircase looks up.
        
        At a hundred it was smaller than the view itself: Stage 1's far wall
        sits a hundred and ten units from the spawn, so the top of the level
        the hub advertises was being cut off by the sky behind it. Everything
        in here is pushed out by the same factor and scaled with it, so the
        horizon comes out looking exactly as it did.
      */}
      <group ref={skyRef}>
        <GradientSky
          topColor={colors.top}
          bottomColor={colors.bottom}
          radius={SKY_RADIUS}
          offset={22 * SKY_SCALE}
        />
        {/* Beyond the tree line but inside the dome, so the hub has a horizon
            to sit in rather than an empty gradient. */}
        <VoxelClouds
          color="#f4fbff"
          radius={80 * SKY_SCALE}
          height={38}
          count={16}
          seed={4242}
        />
        <SkyBody
          color="#fff4c9"
          elevation={0.62}
          size={7 * SKY_SCALE}
          distance={92 * SKY_SCALE}
        />
      </group>

      <Birds />
    </>
  )
}

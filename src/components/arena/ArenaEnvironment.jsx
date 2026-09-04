import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { AREA_TRANSITION_SECONDS, paletteForStage } from '../../data/areas.js'
import { CHAMBER_SPAN, chamberOrigin } from '../../data/arena.js'
import { MAX_STAGES } from '../../data/stages.js'
import { useGameStore } from '../../store/useGameStore.js'
import { playerPosition } from '../../systems/playerState.js'
import GradientSky from '../GradientSky.jsx'
import Chamber from './Chamber.jsx'

const tmpColor = new THREE.Color()

/**
 * The corridor of levels.
 *
 * Chambers are laid end to end at absolute world positions and each keeps its
 * own palette, so walking forward genuinely takes you somewhere new: you can
 * see the next level's colours through the open gate before you reach it, and
 * nothing is ever snapped back into a chamber you already cleared.
 *
 * Only a small window is mounted - the level behind, the one you are in, and
 * the one ahead - so the cost stays flat however deep the run goes.
 */
export default function ArenaEnvironment() {
  const stageIndex = useGameStore((s) => s.stageIndex)
  const scene = useThree((s) => s.scene)

  const keyLightRef = useRef()
  const ambientRef = useRef()
  const glowLightRef = useRef()

  // Mount the neighbours too, so a boundary never pops into existence.
  const window_ = useMemo(() => {
    const out = []
    for (let k = stageIndex - 1; k <= stageIndex + 1; k++) {
      if (k < 0 || k >= MAX_STAGES) continue
      out.push({ stage: k, origin: chamberOrigin(k), palette: paletteForStage(k) })
    }
    return out
  }, [stageIndex])

  /**
   * Sky, fog and lights are global, so they blend toward whichever level the
   * player is currently standing in rather than snapping at the boundary.
   */
  const live = useMemo(() => {
    const p = paletteForStage(0)
    return {
      skyTop: new THREE.Color(p.skyTop),
      skyBottom: new THREE.Color(p.skyBottom),
      fog: new THREE.Color(p.fog),
      key: new THREE.Color(p.key),
      ambient: new THREE.Color(p.ambient),
      glow: new THREE.Color(p.glow),
      fogNear: p.fogNear,
      fogFar: p.fogFar,
      glowStrength: p.glowStrength,
    }
  }, [])

  const fog = useMemo(
    () => new THREE.Fog(live.fog.getHex(), live.fogNear, live.fogFar),
    [live]
  )

  useLayoutEffect(() => {
    const previous = scene.fog
    scene.fog = fog
    return () => {
      scene.fog = previous
    }
  }, [scene, fog])

  const skyRef = useRef()

  useFrame((_, delta) => {
    const target = paletteForStage(stageIndex)
    const t = Math.min(1, delta / AREA_TRANSITION_SECONDS)

    live.skyTop.lerp(tmpColor.set(target.skyTop), t)
    live.skyBottom.lerp(tmpColor.set(target.skyBottom), t)
    live.fog.lerp(tmpColor.set(target.fog), t)
    live.key.lerp(tmpColor.set(target.key), t)
    live.ambient.lerp(tmpColor.set(target.ambient), t)
    live.glow.lerp(tmpColor.set(target.glow), t)
    live.fogNear += (target.fogNear - live.fogNear) * t
    live.fogFar += (target.fogFar - live.fogFar) * t
    live.glowStrength += (target.glowStrength - live.glowStrength) * t

    fog.color.copy(live.fog)
    fog.near = live.fogNear
    fog.far = live.fogFar

    if (keyLightRef.current) {
      keyLightRef.current.color.copy(live.key)
      // The key light travels with the player: one shadow camera cannot cover
      // a corridor that grows to two thousand units long.
      keyLightRef.current.position.set(playerPosition.x + 6, 14, playerPosition.z + 8)
      keyLightRef.current.target.position.set(playerPosition.x, 0, playerPosition.z)
      keyLightRef.current.target.updateMatrixWorld()
    }
    if (ambientRef.current) ambientRef.current.color.copy(live.ambient)

    const pulse = 0.75 + Math.sin(performance.now() * 0.0018) * 0.25
    if (glowLightRef.current) {
      glowLightRef.current.position.set(playerPosition.x, 1.2, playerPosition.z)
      glowLightRef.current.intensity = live.glowStrength * pulse * 2.4
      glowLightRef.current.color.copy(live.glow)
    }

    // The skydome follows too, so the corridor never walks out from under it.
    if (skyRef.current) {
      skyRef.current.position.set(playerPosition.x, 0, playerPosition.z)
    }
  })

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.95} />
      <hemisphereLight intensity={0.4} groundColor="#1b2434" />
      <directionalLight
        ref={keyLightRef}
        position={[6, 14, 8]}
        intensity={1.85}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-8, 5, -6]} intensity={0.55} color="#9ec5ff" />
      <pointLight ref={glowLightRef} distance={30} intensity={0} />

      <group ref={skyRef}>
        <GradientSky topColor={live.skyTop} bottomColor={live.skyBottom} radius={100} />
      </group>

      {window_.map((chamber) => (
        <Chamber key={chamber.stage} palette={chamber.palette} origin={chamber.origin} />
      ))}
    </>
  )
}

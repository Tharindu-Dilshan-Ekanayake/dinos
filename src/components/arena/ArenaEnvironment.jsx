import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { paletteForStage } from '../../data/areas.js'
import {
  APPROACH_EDGE_Z,
  chamberOrigin,
  chamberWindow,
} from '../../data/arena.js'
import { MAX_STAGES } from '../../data/stages.js'
import {
  HORIZON_DISTANCE,
  buildRidge,
  skyMoodForStage,
  weatherForStage,
} from '../../data/weather.js'
import { useGameStore } from '../../store/useGameStore.js'
import { playerPosition } from '../../systems/playerState.js'
import Birds from '../Birds.jsx'
import GradientSky from '../GradientSky.jsx'
import InstancedBlocks from '../InstancedBlocks.jsx'
import SkyBody from '../SkyBody.jsx'
import VoxelClouds from '../VoxelClouds.jsx'
import Chamber from './Chamber.jsx'
import { useQuality } from '../../systems/useQuality.js'

const tmpColor = new THREE.Color()
const WHITE = new THREE.Color('#ffffff')
/** Sunset. Warm moods lean the sky toward this. */
const SUNSET = new THREE.Color('#ff9a4d')

/**
 * Applies a stage's mood to one of its palette colours.
 *
 * Warmth swings toward sunset and darken pulls the whole thing down, which is
 * what turns the same biome into morning, golden hour or an overcast
 * afternoon without giving every stage its own hand-written palette.
 */
function applyMood(color, warmth, darken) {
  if (warmth > 0) color.lerp(SUNSET, warmth * 0.45)
  else if (warmth < 0) color.lerp(WHITE, -warmth * 0.5)
  if (darken > 0) color.multiplyScalar(1 - darken)
  return color
}

/**
 * Ground stretching past the mounted chambers.
 *
 * Only three chambers exist at a time, which leaves the corridor's floor
 * ending some forty units ahead of the player - well inside the fog's far
 * plane, so the edge would be visible through the gate. This sits a hair below
 * the chamber slabs, follows the player, and fills that horizon with the
 * current level's ground colour.
 */
/** Ground out to the skyline, and a hair below the chamber slabs. */
const BEDROCK_SIZE = HORIZON_DISTANCE * 2.4
const BEDROCK_DROP = 0.08

/** The skydome has to contain the skyline, and the camera has to reach past it. */
const SKY_RADIUS = HORIZON_DISTANCE * 1.35

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
  // A 512 map is a quarter of the pixels to fill and a quarter of the memory
  // to sample, which on a weak GPU is the difference between shadows being
  // affordable and being switched off entirely.
  const { shadowMapSize } = useQuality()

  const stageIndex = useGameStore((s) => s.stageIndex)
  const scene = useThree((s) => s.scene)

  const keyLightRef = useRef()
  const ambientRef = useRef()
  const glowLightRef = useRef()

  // What the air and the sky are doing at this level.
  // Atmosphere is deliberately fixed across the corridor. The terrain can
  // vary by room, but changing global fog, sky and lights at the exact
  // boundary makes a normal walk read like a transition.
  const weather = useMemo(() => weatherForStage(0), [])
  const mood = useMemo(() => skyMoodForStage(0), [])
  // The skyline belongs to the biome: forested hills, smoking volcanoes, ice
  // mountains, marsh mounds or rift crystal.
  const ridge = useMemo(
    () => buildRidge(0, mood, paletteForStage(0).ridge),
    [mood]
  )

  /*
   * Mount the neighbours too, so a boundary never pops into existence - and
   * enough of them either side that the corridor reads as one continuous
   * place: three levels ahead seen through the open gate, three behind through
   * the doorway you came in by, each one framed inside the last.
   */
  const window_ = useMemo(
    () =>
      chamberWindow(stageIndex, MAX_STAGES).map((stage) => ({
        stage,
        origin: chamberOrigin(stage),
        palette: paletteForStage(stage),
      })),
    [stageIndex]
  )

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
      floor: new THREE.Color(p.floorA),
      cloud: new THREE.Color(p.skyBottom),
      ridge: new THREE.Color(p.fog),
      ridgeCap: new THREE.Color(p.ridgeCap),
      fogNear: p.fogNear,
      fogFar: p.fogFar,
      glowStrength: p.glowStrength,
    }
  }, [])

  const fog = useMemo(
    () => new THREE.Fog(live.fog.getHex(), live.fogNear, live.fogFar),
    [live]
  )

  /*
   * Both hold their Color by reference rather than by value, so the per-frame
   * lerp below recolours them without a re-render - the same trick the sky
   * uniforms use.
   */
  const bedrockMaterial = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 })
    material.color = live.floor
    return material
  }, [live])

  /*
   * The skyline sits past the fog's far plane, so it opts out of fog and wears
   * the haze in its colour instead - exactly the trick the clouds use. With fog
   * on it would simply dissolve and there would be no horizon at all.
   */
  const ridgeMaterials = useMemo(() => {
    const base = new THREE.MeshBasicMaterial({ fog: false })
    base.color = live.ridge
    // Caps are unlit too, which is what lets a crater or a rift shard read as
    // glowing rather than merely pale.
    const cap = new THREE.MeshBasicMaterial({ fog: false })
    cap.color = live.ridgeCap
    return { base, cap }
  }, [live])

  /*
   * A box for the stacked styles, a four-sided cone for the rest - one
   * geometry serves a whole biome's horizon and its caps.
   */
  const ridgeGeometry = useMemo(
    () =>
      ridge.taper >= 1
        ? new THREE.BoxGeometry(1, 1, 1)
        : new THREE.CylinderGeometry(0.5 * ridge.taper, 0.5, 1, 4),
    [ridge.taper]
  )

  useEffect(() => () => ridgeGeometry.dispose(), [ridgeGeometry])

  useEffect(
    () => () => {
      bedrockMaterial.dispose()
      Object.values(ridgeMaterials).forEach((m) => m.dispose())
    },
    [bedrockMaterial, ridgeMaterials]
  )

  useLayoutEffect(() => {
    const previous = scene.fog
    scene.fog = fog
    return () => {
      scene.fog = previous
    }
  }, [scene, fog])

  const skyRef = useRef()
  const bedrockRef = useRef()

  useFrame((_, delta) => {
    const target = paletteForStage(0)
    // Keep the shared air fixed; individual chambers carry their own palette.
    const t = 1

    // The stage's own hour of the day, plus whatever the weather is adding.
    const warmth = mood.warmth
    const darken = mood.darken + (weather.darken ?? 0)

    // Warmth lands on the horizon, not the zenith: a sunset keeps a deep blue
    // overhead, and lerping the top toward orange only turns it muddy purple.
    live.skyTop.lerp(applyMood(tmpColor.set(target.skyTop), warmth * 0.3, darken), t)
    live.skyBottom.lerp(applyMood(tmpColor.set(target.skyBottom), warmth * 1.25, darken), t)
    live.fog.lerp(applyMood(tmpColor.set(target.fog), warmth, darken), t)
    live.key.lerp(applyMood(tmpColor.set(target.key), warmth, darken * 0.8), t)
    live.ambient.lerp(applyMood(tmpColor.set(target.ambient), warmth * 0.5, darken * 0.6), t)
    live.glow.lerp(tmpColor.set(target.glow), t)
    live.floor.lerp(applyMood(tmpColor.set(target.floorA), warmth * 0.4, darken * 0.5), t)
    // Clouds are the horizon washed out toward white, so they read as brighter
    // than the sky they hang in whatever the biome is doing.
    live.cloud.copy(live.skyBottom).lerp(WHITE, 0.5)
    // Distant land: the sky it stands against, pulled toward the ground colour
    // and darkened. Reading *darker* than the sky is what makes a silhouette a
    // mountain rather than a pale slab hanging in the air.
    live.ridge.copy(live.skyBottom).lerp(live.floor, 0.42).multiplyScalar(0.82)
    // Caps keep much more of their own colour - snow and lava are the point.
    live.ridgeCap.lerp(tmpColor.set(target.ridgeCap).lerp(live.skyBottom, 0.25), t)
    live.fogNear += (target.fogNear - live.fogNear) * t
    // Rain, snow and ash close the air in.
    const fogFar = target.fogFar * (1 - (weather.fogPull ?? 0))
    live.fogFar += (fogFar - live.fogFar) * t
    live.glowStrength += (target.glowStrength - live.glowStrength) * t

    fog.color.copy(live.fog)
    fog.near = live.fogNear
    fog.far = live.fogFar

    /*
     * Everything below follows the player in *world* space, so it reads the
     * world position, which is the only kind there is.
     * Read once here: it is a shared scratch, and one frame wants one value.
     */
    const player = playerPosition

    if (keyLightRef.current) {
      keyLightRef.current.color.copy(live.key)
      // A storm does not just add streaks - it takes the sun away.
      keyLightRef.current.intensity = 1.85 * (1 - darken * 0.75)
      // The key light travels with the player: one shadow camera cannot cover
      // a corridor that grows to two thousand units long.
      keyLightRef.current.position.set(player.x + 6, 14, player.z + 8)
      keyLightRef.current.target.position.set(player.x, 0, player.z)
      keyLightRef.current.target.updateMatrixWorld()
    }
    if (ambientRef.current) ambientRef.current.color.copy(live.ambient)

    if (glowLightRef.current) {
      glowLightRef.current.position.set(player.x, 1.2, player.z)
      glowLightRef.current.intensity = live.glowStrength * 2.4
      glowLightRef.current.color.copy(live.glow)
    }

    // The skydome follows too, so the corridor never walks out from under it.
    if (skyRef.current) {
      skyRef.current.position.set(player.x, 0, player.z)
    }

    /*
     * The bedrock rides with the player as well, but its leading edge stops at
     * the arena's mouth. Past that the ground falls six metres to the hub, and
     * a plane sitting at the arena's own floor level would bury the stairs,
     * the plaza and everything on it under a sheet of flat green.
     */
    if (bedrockRef.current) {
      const far = APPROACH_EDGE_Z - BEDROCK_SIZE / 2
      bedrockRef.current.position.set(player.x, -BEDROCK_DROP, Math.min(player.z, far))
    }
  })

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.95} />
      {/* The corridor is a slot between two cliffs, so its inner faces see
          almost nothing of the key light. A brighter bounce keeps the voxel
          detail in them readable instead of sinking into silhouette. */}
      <hemisphereLight intensity={0.6} groundColor="#4a5a6b" />
      <directionalLight
        ref={keyLightRef}
        position={[6, 14, 8]}
        intensity={1.85}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        /*
         * Wide enough to cover the whole room, because its edge is visible.
         *
         * Outside a shadow camera's box three.js simply does not shadow, so the
         * frustum boundary lands on the ground as a perfectly straight tonal
         * seam - shaded on the inside, fully lit on the outside. At twenty it
         * fell across the middle of a chamber, and on flat ground a hard
         * straight line between two tones does not read as the edge of a shadow
         * map, it reads as a step: Stage 1 looked like it had a bank across it.
         *
         * Thirty-eight clears `halfWidth` and the walls at both ends, so the
         * seam now falls outside the room entirely. It costs sharpness - the
         * same map stretched over a bigger box - which is the right trade: a
         * slightly softer shadow is a shadow, and a straight line across the
         * floor is a bug.
         */
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={38}
        shadow-camera-bottom={-38}
        shadow-camera-far={110}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-8, 5, -6]} intensity={0.7} color="#9ec5ff" />
      <pointLight ref={glowLightRef} distance={30} intensity={0} />

      {/* Everything in here rides with the player, so the corridor can never
          walk out from under the sky or off the edge of the world. */}
      <group ref={skyRef}>
        <GradientSky
          topColor={live.skyTop}
          bottomColor={live.skyBottom}
          radius={SKY_RADIUS}
        />
        {/* Cloud cover is part of the stage's weather report: a storm rolls in
            with three times the cloud of a clear afternoon. */}
        <VoxelClouds
          color={live.cloud}
          count={mood.clouds + (weather.cloudBoost ?? 0)}
          radius={HORIZON_DISTANCE * 0.88}
          height={mood.cloudHeight}
          seed={8675309}
        />
        {/* Hung in the key light's own direction, so the shadows on the
            ground point away from it. */}
        {/* Out past the skyline, and scaled with it so it hangs the same size
            in the sky as it always did. */}
        <SkyBody
          color={mood.sun.color}
          elevation={mood.sun.elevation}
          size={mood.sun.size * (HORIZON_DISTANCE * 1.1) / 92}
          distance={HORIZON_DISTANCE * 1.1}
        />
        {/* A different skyline every level, and a different *kind* of skyline
            every biome. */}
        <InstancedBlocks
          items={ridge.base}
          geometry={ridgeGeometry}
          material={ridgeMaterials.base}
        />
        <InstancedBlocks
          items={ridge.caps}
          geometry={ridgeGeometry}
          material={ridgeMaterials.cap}
        />
      </group>

      <mesh ref={bedrockRef} rotation-x={-Math.PI / 2} material={bedrockMaterial}>
        <planeGeometry args={[BEDROCK_SIZE, BEDROCK_SIZE]} />
      </mesh>

      {/* Nothing flies in a downpour or a blizzard. */}
      <Birds hidden={(weather.darken ?? 0) > 0.12 || (weather.fogPull ?? 0) > 0.3} />

      {window_.map((chamber) => (
        <Chamber
          key={chamber.stage}
          stage={chamber.stage}
          palette={chamber.palette}
          origin={chamber.origin}
        />
      ))}
    </>
  )
}

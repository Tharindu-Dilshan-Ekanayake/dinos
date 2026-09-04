import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { AREAS, AREA_TRANSITION_SECONDS } from '../data/areas.js'
import { useGameStore } from '../store/useGameStore.js'

/**
 * Procedural gradient sky.
 *
 * drei's <Environment> presets stream HDRIs from a CDN, which stalls the whole
 * scene on a slow or offline connection. A two-colour gradient shader gives us
 * per-area skies that are free, instant and trivially lerp-able between areas.
 */
const skyVertex = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const skyFragment = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform float offset;
  uniform float exponent;
  varying vec3 vWorldPosition;
  void main() {
    float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
    float mixAmount = pow(max(h, 0.0), exponent);
    gl_FragColor = vec4(mix(bottomColor, topColor, mixAmount), 1.0);
  }
`

/** Scatter positions for the decorative rim props - stable across renders. */
function useScatter(count) {
  return useMemo(() => {
    const items = []
    // A fixed LCG keeps the layout identical between reloads.
    let seed = 1337
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand() * 0.4
      const radius = 9 + rand() * 7
      items.push({
        position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius - 2],
        scale: 0.6 + rand() * 1.9,
        rotation: rand() * Math.PI,
        lean: (rand() - 0.5) * 0.25,
      })
    }
    return items
  }, [count])
}

export default function AreaEnvironment() {
  const areaIndex = useGameStore((s) => s.areaIndex)
  const scene = useThree((s) => s.scene)

  const skyRef = useRef()
  const groundRef = useRef()
  const accentRef = useRef()
  const keyLightRef = useRef()
  const ambientRef = useRef()
  const scatter = useScatter(22)

  // Live colours, mutated in useFrame so an area change never re-renders.
  const colors = useMemo(() => {
    const a = AREAS[0]
    return {
      skyTop: new THREE.Color(a.skyTop),
      skyBottom: new THREE.Color(a.skyBottom),
      fog: new THREE.Color(a.fog),
      ground: new THREE.Color(a.ground),
      accent: new THREE.Color(a.groundAccent),
      key: new THREE.Color(a.key),
      ambient: new THREE.Color(a.ambient),
      fogNear: a.fogNear,
      fogFar: a.fogFar,
    }
  }, [])

  const skyUniforms = useMemo(
    () => ({
      topColor: { value: colors.skyTop },
      bottomColor: { value: colors.skyBottom },
      offset: { value: 8 },
      exponent: { value: 0.7 },
    }),
    [colors]
  )

  // Fog is owned by this component for the whole app.
  const fog = useMemo(
    () => new THREE.Fog(colors.fog.getHex(), colors.fogNear, colors.fogFar),
    [colors]
  )

  // One shared geometry/material for the rim props: a single material means the
  // per-frame colour lerp reaches all of them with one write.
  const scatterGeometry = useMemo(() => new THREE.ConeGeometry(0.55, 2.2, 5), [])
  const scatterMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: colors.accent.clone(), roughness: 0.9 }),
    [colors]
  )

  useLayoutEffect(() => {
    const previous = scene.fog
    scene.fog = fog
    return () => {
      scene.fog = previous
    }
  }, [scene, fog])

  useEffect(
    () => () => {
      scatterGeometry.dispose()
      scatterMaterial.dispose()
    },
    [scatterGeometry, scatterMaterial]
  )

  useFrame((_, delta) => {
    const target = AREAS[areaIndex] ?? AREAS[0]
    // Frame-rate independent lerp toward the target palette.
    const t = Math.min(1, delta / AREA_TRANSITION_SECONDS)

    colors.skyTop.lerp(tmpColor.set(target.skyTop), t)
    colors.skyBottom.lerp(tmpColor.set(target.skyBottom), t)
    colors.fog.lerp(tmpColor.set(target.fog), t)
    colors.ground.lerp(tmpColor.set(target.ground), t)
    colors.accent.lerp(tmpColor.set(target.groundAccent), t)
    colors.key.lerp(tmpColor.set(target.key), t)
    colors.ambient.lerp(tmpColor.set(target.ambient), t)
    colors.fogNear += (target.fogNear - colors.fogNear) * t
    colors.fogFar += (target.fogFar - colors.fogFar) * t

    fog.color.copy(colors.fog)
    fog.near = colors.fogNear
    fog.far = colors.fogFar

    if (groundRef.current) groundRef.current.color.copy(colors.ground)
    if (accentRef.current) accentRef.current.color.copy(colors.accent)
    if (keyLightRef.current) keyLightRef.current.color.copy(colors.key)
    if (ambientRef.current) ambientRef.current.color.copy(colors.ambient)
    scatterMaterial.color.copy(colors.accent)
  })

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.85} />
      <hemisphereLight intensity={0.35} groundColor="#1b2434" />
      <directionalLight
        ref={keyLightRef}
        position={[5, 9, 6]}
        intensity={1.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0004}
      />
      {/* Cool rim light keeps silhouettes readable against a bright sky. */}
      <directionalLight position={[-6, 4, -5]} intensity={0.5} color="#9ec5ff" />

      <mesh ref={skyRef} scale={60}>
        <sphereGeometry args={[1, 24, 16]} />
        <shaderMaterial
          uniforms={skyUniforms}
          vertexShader={skyVertex}
          fragmentShader={skyFragment}
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
        <circleGeometry args={[34, 48]} />
        <meshStandardMaterial ref={groundRef} roughness={0.95} metalness={0} />
      </mesh>

      {/* Raised arena pad so the fighters read as standing on a stage. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} receiveShadow>
        <ringGeometry args={[5.4, 6.1, 48]} />
        <meshStandardMaterial ref={accentRef} roughness={0.8} />
      </mesh>

      {scatter.map((item, i) => (
        <mesh
          key={i}
          geometry={scatterGeometry}
          material={scatterMaterial}
          position={item.position}
          rotation={[item.lean, item.rotation, 0]}
          scale={item.scale}
          castShadow
        />
      ))}
    </>
  )
}

// Scratch colour reused every frame instead of allocating in the render loop.
const tmpColor = new THREE.Color()

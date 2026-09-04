import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import ModelFallback from './ModelFallback.jsx'

/**
 * The dino, shared by every place one appears: the arena fighter, the player
 * walking around the hub, and the showcase model on each stage podium.
 *
 * The placeholder is built from flat-shaded boxes rather than smooth spheres -
 * a chunky voxel silhouette holds up far better at small sizes, reads clearly
 * against a bright hub, and matches the blocky look the rest of the level uses.
 *
 * Limbs, neck and tail hang off named groups collected into a "rig", so one
 * shared animator can walk any stage without each caller knowing the model's
 * internals. Every stage drives the same builder through the shape flags in
 * data/evolutions.js, so thirteen distinct dinos cost one mesh description.
 */

/* ------------------------------------------------------------- materials */

/** Builds the per-stage material set. Callers own disposal. */
export function useDinoMaterials(evolution) {
  const materials = useMemo(() => {
    const glow = evolution.glow ?? 0

    const body = new THREE.MeshStandardMaterial({
      color: evolution.body,
      roughness: 0.7,
      flatShading: true,
    })
    const belly = new THREE.MeshStandardMaterial({
      color: evolution.belly,
      roughness: 0.78,
      flatShading: true,
    })
    const spike = new THREE.MeshStandardMaterial({
      color: evolution.spike,
      roughness: 0.42,
      flatShading: true,
      emissive: new THREE.Color(evolution.spike),
      emissiveIntensity: glow * 0.85,
    })
    const eye = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.22 })
    const pupil = new THREE.MeshStandardMaterial({ color: '#141a26', roughness: 0.4 })

    // Late stages glow from the inside rather than just wearing bright colours.
    if (glow > 0) {
      body.emissive = new THREE.Color(evolution.aura)
      body.emissiveIntensity = glow * 0.26
    }

    return { body, belly, spike, eye, pupil }
  }, [evolution])

  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

  return materials
}

/* ------------------------------------------------------------------- rig */

/**
 * Handles onto the animated parts. Populated by callback refs as the model
 * mounts, so a stage that lacks a part simply leaves it null.
 */
export function useDinoRig() {
  return useRef({
    body: null,
    head: null,
    tail: null,
    legFrontL: null,
    legFrontR: null,
    legBackL: null,
    legBackR: null,
  })
}

/**
 * Walk cycle, shared by the player and the podium showcases.
 *
 * `speed` is 0-1 (how hard the dino is moving) and `stride` is the ever
 * advancing phase. Front and back legs run in diagonal pairs, the way a real
 * quadruped moves; a biped just swings its two legs in opposition.
 */
export function animateDinoRig(rig, speed, stride) {
  if (!rig) return

  const swing = Math.sin(stride)
  const opposite = Math.sin(stride + Math.PI)
  const amount = 0.15 + speed * 0.85

  if (rig.legBackL) rig.legBackL.rotation.z = swing * amount
  if (rig.legBackR) rig.legBackR.rotation.z = opposite * amount
  // Diagonal gait: each front leg matches the opposite back leg.
  if (rig.legFrontL) rig.legFrontL.rotation.z = opposite * amount * 0.75
  if (rig.legFrontR) rig.legFrontR.rotation.z = swing * amount * 0.75

  if (rig.body) {
    // Two bounces per stride - one for each footfall.
    rig.body.position.y = Math.abs(Math.sin(stride)) * 0.1 * speed
    rig.body.rotation.z = Math.sin(stride * 2) * 0.03 * speed
  }

  // The tail keeps swaying at rest, which stops an idle dino looking frozen.
  if (rig.tail) {
    rig.tail.rotation.y = Math.sin(stride * 0.7) * (0.12 + speed * 0.22)
    rig.tail.rotation.z = Math.sin(stride * 1.4) * 0.05 * speed
  }
  if (rig.head) {
    rig.head.rotation.z = -Math.sin(stride) * 0.05 * speed
    rig.head.rotation.y = Math.sin(stride * 0.45) * 0.07
  }
}

/* ---------------------------------------------------------------- pieces */

/** One box. Shorthand keeps the model description readable. */
function Box({ material, position, size, rotation, castShadow = true }) {
  return (
    <mesh material={material} position={position} rotation={rotation} castShadow={castShadow}>
      <boxGeometry args={size} />
    </mesh>
  )
}

/**
 * A leg that pivots at the hip.
 *
 * The group sits at the hip and everything hangs below it, so a single
 * rotation about Z swings the whole limb forward and back.
 */
function Leg({ materials, innerRef, position, thickness = 1, length = 1, clawed = true }) {
  const { body, spike } = materials
  return (
    <group ref={innerRef} position={position}>
      <Box
        material={body}
        position={[0, -0.34 * length, 0]}
        size={[0.56 * thickness, 0.72 * length, 0.46 * thickness]}
      />
      <Box
        material={body}
        position={[0.06 * thickness, -0.76 * length, 0]}
        size={[0.36 * thickness, 0.56 * length, 0.36 * thickness]}
      />
      <Box
        material={body}
        position={[0.16 * thickness, -1.0 * length, 0]}
        size={[0.66 * thickness, 0.22, 0.42 * thickness]}
      />
      {clawed &&
        [-0.12, 0.12].map((cz) => (
          <Box
            key={cz}
            material={spike}
            position={[0.44 * thickness, -1.03 * length, cz]}
            size={[0.16, 0.14, 0.13]}
            castShadow={false}
          />
        ))}
    </group>
  )
}

/** Tapering tail built as a chain, so the root group sways the whole thing. */
function Tail({ materials, innerRef, evolution }) {
  const { body, spike } = materials
  const segments = useMemo(() => {
    const out = []
    const count = 7
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1)
      out.push({
        position: [-0.34 - i * 0.36, -t * t * 0.42, 0],
        size: [0.44, 0.5 - t * 0.32, 0.5 - t * 0.32],
      })
    }
    return out
  }, [])

  return (
    <group ref={innerRef} position={[-0.85, 1.08, 0]}>
      {segments.map((segment, i) => (
        <Box key={i} material={body} position={segment.position} size={segment.size} />
      ))}

      {evolution.tailSpikes && (
        <>
          <Box material={spike} position={[-2.75, -0.44, 0]} size={[0.5, 0.5, 0.5]} />
          {[-0.36, 0.36].map((z) => (
            <Box key={z} material={spike} position={[-2.85, -0.44, z]} size={[0.34, 0.18, 0.3]} />
          ))}
          <Box
            material={spike}
            position={[-3.1, -0.44, 0]}
            size={[0.34, 0.18, 0.3]}
            rotation={[0, 0, 0]}
          />
        </>
      )}
    </group>
  )
}

/** Head group: skull, jaw, teeth, eyes, horns and optional frill. */
function Head({ materials, innerRef, evolution }) {
  const { body, belly, spike, eye, pupil } = materials
  const horns = evolution.horns ?? 0

  return (
    <group ref={innerRef} position={[0.95, 1.68, 0]}>
      {/* Neck */}
      <Box material={body} position={[0.05, -0.06, 0]} size={[0.6, 0.6, 0.62]} />

      {/* Frill, triceratops style */}
      {evolution.frill && (
        <>
          <Box material={spike} position={[0.16, 0.42, 0]} size={[0.18, 0.8, 1.6]} />
          <Box material={spike} position={[0.16, 0.06, 0.78]} size={[0.18, 0.5, 0.34]} />
          <Box material={spike} position={[0.16, 0.06, -0.78]} size={[0.18, 0.5, 0.34]} />
          {[-0.6, 0, 0.6].map((z) => (
            <Box
              key={z}
              material={spike}
              position={[0.16, 0.86, z]}
              size={[0.16, 0.26, 0.2]}
              castShadow={false}
            />
          ))}
        </>
      )}

      {/* Skull */}
      <Box material={body} position={[0.52, 0.12, 0]} size={[0.82, 0.72, 0.8]} />
      {/* Brow ridge */}
      <Box material={body} position={[0.68, 0.46, 0]} size={[0.56, 0.16, 0.86]} />
      {/* Snout */}
      <Box material={body} position={[1.06, 0.04, 0]} size={[0.5, 0.46, 0.62]} />
      {/* Lower jaw */}
      <Box material={belly} position={[1.0, -0.2, 0]} size={[0.62, 0.18, 0.56]} />
      {/* Nostril block */}
      <Box material={body} position={[1.28, 0.16, 0]} size={[0.16, 0.2, 0.44]} castShadow={false} />

      {/* Teeth */}
      {[-0.2, -0.07, 0.07, 0.2].map((z) => (
        <Box
          key={z}
          material={eye}
          position={[1.26, -0.08, z]}
          size={[0.1, 0.17, 0.09]}
          castShadow={false}
        />
      ))}

      {/* Eyes */}
      {[-0.32, 0.32].map((z) => (
        <group key={z}>
          <Box material={eye} position={[0.78, 0.3, z]} size={[0.24, 0.24, 0.16]} castShadow={false} />
          <Box material={pupil} position={[0.88, 0.3, z]} size={[0.08, 0.14, 0.11]} castShadow={false} />
        </group>
      ))}

      {/* Nose horn */}
      {horns >= 1 && (
        <Box
          material={spike}
          position={[1.24, 0.42, 0]}
          size={[0.18, 0.46, 0.18]}
          rotation={[0, 0, -0.32]}
        />
      )}
      {/* Brow horns */}
      {horns >= 2 &&
        [-0.3, 0.3].map((z) => (
          <Box
            key={z}
            material={spike}
            position={[0.66, 0.72, z]}
            size={[0.17, 0.54, 0.17]}
            rotation={[z > 0 ? -0.2 : 0.2, 0, -0.1]}
          />
        ))}
      {/* Crown horns */}
      {horns >= 3 &&
        [-0.46, 0.46].map((z) => (
          <Box
            key={z}
            material={spike}
            position={[0.36, 0.82, z]}
            size={[0.15, 0.66, 0.15]}
            rotation={[z > 0 ? -0.4 : 0.4, 0, 0.12]}
          />
        ))}
    </group>
  )
}

/* ------------------------------------------------------------------ dino */

/**
 * Blocky placeholder dino, restyled per stage. Faces +X, feet on y = 0.
 */
export function PrimitiveDino({ evolution, materials, rig }) {
  const { body, belly, spike } = materials
  const quad = evolution.legs === 4

  // Ref plumbing: assign into the shared rig if one was supplied.
  const assign = (key) => (node) => {
    if (rig) rig.current[key] = node
  }

  /** Back plates / sail, sized by the stage's plate count. */
  const plates = useMemo(() => {
    const out = []
    const count = evolution.plates ?? 0
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1)
      // Tallest over the hips, tapering toward neck and tail.
      const height = (evolution.crest ? 0.95 : 0.5) * (0.4 + Math.sin(t * Math.PI) * 0.9)
      out.push({
        position: [-0.8 + t * 1.6, 1.52 + height / 2, 0],
        size: [0.2, height, evolution.crest ? 0.16 : 0.4],
      })
    }
    return out
  }, [evolution.plates, evolution.crest])

  return (
    <group>
      <group ref={assign('body')}>
        {/* ----------------------------------------------------------- torso */}
        <Box material={body} position={[-0.2, 1.15, 0]} size={[1.55, 1.1, 1.05]} />
        <Box material={body} position={[0.5, 1.22, 0]} size={[0.72, 0.9, 0.9]} />
        {/* Hips */}
        <Box material={body} position={[-0.86, 1.08, 0]} size={[0.7, 0.86, 0.92]} />
        {/* Belly panel */}
        <Box material={belly} position={[-0.15, 0.78, 0]} size={[1.42, 0.44, 0.92]} />
        {/* Shoulder stripe adds a second colour break along the flank */}
        {[-0.54, 0.54].map((z) => (
          <Box
            key={z}
            material={belly}
            position={[0.1, 1.42, z]}
            size={[0.9, 0.24, 0.06]}
            castShadow={false}
          />
        ))}

        {/* ---------------------------------------------------------- plates */}
        {plates.map((plate, i) => (
          <Box key={i} material={spike} position={plate.position} size={plate.size} />
        ))}

        <Head materials={materials} innerRef={assign('head')} evolution={evolution} />
        <Tail materials={materials} innerRef={assign('tail')} evolution={evolution} />

        {/* ------------------------------------------------- front limbs */}
        {quad ? (
          <>
            <Leg
              materials={materials}
              innerRef={assign('legFrontL')}
              position={[0.5, 1.0, -0.46]}
              thickness={0.82}
              length={0.82}
            />
            <Leg
              materials={materials}
              innerRef={assign('legFrontR')}
              position={[0.5, 1.0, 0.46]}
              thickness={0.82}
              length={0.82}
            />
          </>
        ) : (
          <>
            {/* Small arms, still swung by the walk cycle */}
            <group ref={assign('legFrontL')} position={[0.66, 1.2, -0.5]}>
              <Box material={body} position={[0, -0.22, 0]} size={[0.24, 0.44, 0.24]} />
              <Box material={body} position={[0.12, -0.5, 0]} size={[0.2, 0.3, 0.2]} />
              <Box material={spike} position={[0.24, -0.62, 0]} size={[0.16, 0.14, 0.16]} castShadow={false} />
            </group>
            <group ref={assign('legFrontR')} position={[0.66, 1.2, 0.5]}>
              <Box material={body} position={[0, -0.22, 0]} size={[0.24, 0.44, 0.24]} />
              <Box material={body} position={[0.12, -0.5, 0]} size={[0.2, 0.3, 0.2]} />
              <Box material={spike} position={[0.24, -0.62, 0]} size={[0.16, 0.14, 0.16]} castShadow={false} />
            </group>
          </>
        )}

        {/* -------------------------------------------------- back legs */}
        <Leg
          materials={materials}
          innerRef={assign('legBackL')}
          position={[-0.5, 1.06, -0.46]}
          thickness={quad ? 0.95 : 1.1}
          length={quad ? 0.9 : 1}
        />
        <Leg
          materials={materials}
          innerRef={assign('legBackR')}
          position={[-0.5, 1.06, 0.46]}
          thickness={quad ? 0.95 : 1.1}
          length={quad ? 0.9 : 1}
        />
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ GLB */

/** Real asset path, used once a stage has a `model` in data/evolutions.js. */
function GltfDino({ url }) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => {
    const copy = scene.clone(true)
    copy.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return copy
  }, [scene])
  return <primitive object={model} />
}

/**
 * Picks the GLB when a stage has one and falls back to the blocky dino
 * otherwise - including when the GLB fails to load, so a bad asset path never
 * blanks the scene.
 */
export default function DinoModel({ evolution, materials, rig }) {
  const fallback = <PrimitiveDino evolution={evolution} materials={materials} rig={rig} />

  if (!evolution.model) return fallback

  return (
    <ModelFallback resetKey={evolution.id} fallback={fallback}>
      <Suspense fallback={fallback}>
        <GltfDino url={evolution.model} />
      </Suspense>
    </ModelFallback>
  )
}

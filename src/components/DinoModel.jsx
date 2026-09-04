import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import ModelFallback from './ModelFallback.jsx'

/**
 * The dino, shared by every place one appears: the arena fighter, the player
 * walking around the hub, and the showcase model on each stage podium.
 *
 * It is built from flat-shaded boxes rather than smooth spheres - a chunky
 * voxel silhouette holds up far better at small sizes, reads clearly against a
 * bright hub, and matches the blocky look the rest of the level uses.
 *
 * The model is *described* as data and then merged: every box belonging to one
 * body part and one material becomes a single geometry, so a dino carrying
 * sixty blocks of detail costs about a dozen draw calls instead of sixty. That
 * is what pays for the toes, teeth, cheeks and eye highlights - thirteen of
 * these are on screen at once in the hub.
 *
 * Limbs, neck and tail hang off named groups collected into a "rig", so one
 * shared animator can walk any stage without each caller knowing the model's
 * internals. Every stage drives the same description through the shape flags
 * in data/evolutions.js, so thirteen distinct dinos cost one mesh definition.
 */

/* ------------------------------------------------------------- materials */

/** Which material groups are worth the shadow pass. Eyes and teeth are not. */
const CASTS_SHADOW = { body: true, belly: true, spike: true, eye: false, pupil: false }

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
    // A touch of self-lighting keeps the eyes bright in the arena's shade,
    // which is most of what makes the face read as friendly rather than dead.
    const eye = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.22,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.25,
    })
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

/* ------------------------------------------------------------- merging */

/**
 * One merged geometry per material used by a part.
 *
 * Boxes are baked into their part's local space here, so the rig still rotates
 * whole limbs while the blocks inside a limb cost nothing extra to draw. The
 * result is shared: a left and a right leg are the same description and so
 * draw from the same geometry.
 */
function useMergedGroups(boxes) {
  const groups = useMemo(() => {
    const byMaterial = new Map()

    for (const box of boxes) {
      const geometry = new THREE.BoxGeometry(box.size[0], box.size[1], box.size[2])
      if (box.rotation) {
        geometry.rotateX(box.rotation[0])
        geometry.rotateY(box.rotation[1])
        geometry.rotateZ(box.rotation[2])
      }
      geometry.translate(box.position[0], box.position[1], box.position[2])

      const list = byMaterial.get(box.material)
      if (list) list.push(geometry)
      else byMaterial.set(box.material, [geometry])
    }

    const out = []
    for (const [key, list] of byMaterial) {
      const merged = mergeGeometries(list, false)
      list.forEach((geometry) => geometry.dispose())
      if (merged) out.push({ key, geometry: merged })
    }
    return out
  }, [boxes])

  useEffect(() => () => groups.forEach((group) => group.geometry.dispose()), [groups])

  return groups
}

/** Draws one part's merged geometries with the stage's materials. */
function PartMeshes({ groups, materials }) {
  return (
    <>
      {groups.map((group) => (
        <mesh
          key={group.key}
          geometry={group.geometry}
          material={materials[group.key]}
          castShadow={CASTS_SHADOW[group.key]}
        />
      ))}
    </>
  )
}

/* ------------------------------------------------------- shape description */

const box = (material, position, size, rotation) => ({ material, position, size, rotation })

/**
 * Torso: a barrel chest over a pale belly, with the flank stripe that gives
 * every stage a second colour break along its side.
 */
function torsoBoxes(evolution) {
  const out = [
    // Deeper through the chest than it is long: a cartoon animal, not a lizard.
    box('body', [-0.18, 1.18, 0], [1.45, 1.28, 1.14]),
    box('body', [0.5, 1.28, 0], [0.8, 1.05, 1]),
    box('body', [-0.85, 1.12, 0], [0.8, 1, 1]),
    // Pale front, from throat to belly - the read that makes a shape look like
    // an animal rather than a block.
    box('belly', [-0.12, 0.76, 0], [1.5, 0.46, 0.94]),
    box('belly', [0.66, 1.04, 0], [0.58, 0.66, 0.84]),
  ]

  // The pale front carried a little way up each flank, rather than a bright
  // plate stuck on the side.
  for (const z of [-0.552, 0.552]) {
    out.push(box('belly', [-0.05, 1.0, z], [1.3, 0.42, 0.04]))
  }

  /** Back plates / sail, sized by the stage's plate count. */
  const count = evolution.plates ?? 0
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    // Tallest over the hips, tapering toward neck and tail.
    const height = (evolution.crest ? 0.95 : 0.5) * (0.4 + Math.sin(t * Math.PI) * 0.9)
    out.push(
      box('spike', [-0.8 + t * 1.6, 1.55 + height / 2, 0], [0.22, height, evolution.crest ? 0.16 : 0.42])
    )
  }

  return out
}

/** Head: skull, cheeks, snout, jaw, teeth, eyes, and the stage's headgear. */
function headBoxes(evolution) {
  const horns = evolution.horns ?? 0
  const out = [
    box('body', [0.0, -0.12, 0], [0.78, 0.76, 0.8]),
    // Skull, widened at the jaw hinge so the face is square rather than wedged.
    box('body', [0.54, 0.16, 0], [0.98, 0.88, 0.94]),
    box('body', [0.78, 0.58, 0], [0.66, 0.2, 1]),
    box('body', [1.18, 0.06, 0], [0.62, 0.54, 0.74]),
    box('body', [1.26, 0.34, 0], [0.46, 0.22, 0.56]),
    box('belly', [1.1, -0.3, 0], [0.76, 0.24, 0.68]),
    // A dark mouth line does more for the face than any amount of geometry.
    box('pupil', [1.15, -0.14, 0], [0.66, 0.08, 0.7]),
  ]

  for (const z of [-0.48, 0.48]) {
    out.push(box('body', [0.66, -0.06, z], [0.66, 0.48, 0.1]))
    out.push(box('pupil', [1.47, 0.22, z * 0.36], [0.07, 0.1, 0.12]))
  }

  // Teeth along the upper jaw.
  for (const z of [-0.26, -0.09, 0.09, 0.26]) {
    out.push(box('eye', [1.4, -0.06, z], [0.11, 0.2, 0.11]))
  }

  // Eyes: white, pupil, and a highlight square sitting proud of the pupil.
  // Set into the skull's corner rather than pasted flat on its cheek.
  for (const z of [-0.42, 0.42]) {
    const outward = Math.sign(z)
    out.push(box('eye', [0.9, 0.36, z], [0.3, 0.32, 0.17]))
    // Wrapped around the outer front corner, so the dino is looking at you
    // from a three-quarter view instead of showing a blank white patch.
    out.push(box('pupil', [1.0, 0.34, z + outward * 0.035], [0.17, 0.23, 0.14]))
    out.push(box('eye', [1.04, 0.44, z + outward * 0.05], [0.08, 0.09, 0.08]))
  }

  if (evolution.frill) {
    out.push(box('spike', [0.16, 0.42, 0], [0.18, 0.86, 1.7]))
    for (const z of [-0.82, 0.82]) {
      out.push(box('spike', [0.16, 0.06, z], [0.18, 0.5, 0.34]))
    }
    for (const z of [-0.6, 0, 0.6]) {
      out.push(box('spike', [0.16, 0.9, z], [0.16, 0.28, 0.2]))
    }
  }

  if (horns >= 1) out.push(box('spike', [1.4, 0.48, 0], [0.2, 0.54, 0.2], [0, 0, -0.32]))
  if (horns >= 2) {
    for (const z of [-0.33, 0.33]) {
      out.push(box('spike', [0.74, 0.84, z], [0.18, 0.6, 0.18], [z > 0 ? -0.2 : 0.2, 0, -0.1]))
    }
  }
  if (horns >= 3) {
    for (const z of [-0.5, 0.5]) {
      out.push(box('spike', [0.4, 0.94, z], [0.16, 0.72, 0.16], [z > 0 ? -0.4 : 0.4, 0, 0.12]))
    }
  }

  return out
}

/** Tail: a tapering chain, with the club or spikes some stages carry. */
function tailBoxes(evolution) {
  const out = []
  const count = 7

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    out.push(
      box('body', [-0.34 - i * 0.36, -t * t * 0.42, 0], [0.46, 0.52 - t * 0.34, 0.52 - t * 0.34])
    )
  }
  // Rounded-off tip, so the tail ends rather than being cut short.
  out.push(box('body', [-2.68, -0.42, 0], [0.3, 0.2, 0.2]))

  if (evolution.tailSpikes) {
    out.push(box('spike', [-2.82, -0.44, 0], [0.54, 0.54, 0.54]))
    for (const z of [-0.38, 0.38]) {
      out.push(box('spike', [-2.92, -0.44, z], [0.34, 0.2, 0.32]))
    }
    out.push(box('spike', [-3.18, -0.44, 0], [0.36, 0.2, 0.32]))
  }

  return out
}

/**
 * One leg: thigh, shin, foot pad, three toes and their claws.
 *
 * The description hangs below the hip, so the group it lives in can swing the
 * whole limb with a single rotation about Z.
 */
function legBoxes(thickness, length, clawed) {
  const out = [
    box('body', [0, -0.32 * length, 0], [0.6 * thickness, 0.74 * length, 0.5 * thickness]),
    box('body', [0.06 * thickness, -0.76 * length, 0], [0.4 * thickness, 0.58 * length, 0.4 * thickness]),
    box('body', [0.14 * thickness, -1.02 * length, 0], [0.5 * thickness, 0.2, 0.48 * thickness]),
  ]

  for (const z of [-0.16, 0, 0.16]) {
    out.push(box('body', [0.42 * thickness, -1.02 * length, z * thickness], [0.32, 0.19, 0.15]))
    if (clawed) {
      out.push(box('spike', [0.61 * thickness, -1.04 * length, z * thickness], [0.13, 0.13, 0.11]))
    }
  }

  return out
}

/** A biped's little front arms, three-clawed like the feet. */
function armBoxes() {
  const out = [
    box('body', [0, -0.22, 0], [0.26, 0.46, 0.26]),
    box('body', [0.12, -0.5, 0], [0.22, 0.32, 0.22]),
  ]
  for (const z of [-0.07, 0.07]) {
    out.push(box('spike', [0.26, -0.64, z], [0.15, 0.13, 0.1]))
  }
  return out
}

/* ------------------------------------------------------------------ dino */

const HEAD_ORIGIN = [0.98, 1.74, 0]
const TAIL_ORIGIN = [-0.9, 1.12, 0]

/**
 * Blocky dino, restyled per stage. Faces +X, feet on y = 0.
 */
export function PrimitiveDino({ evolution, materials, rig }) {
  const quad = evolution.legs === 4

  const shape = useMemo(
    () => ({
      torso: torsoBoxes(evolution),
      head: headBoxes(evolution),
      tail: tailBoxes(evolution),
      // Front and back limbs differ in build; both sides of a pair share one
      // description, and therefore one merged geometry.
      front: quad ? legBoxes(0.92, 0.82, true) : armBoxes(),
      back: legBoxes(quad ? 1.05 : 1.2, quad ? 0.9 : 1, true),
    }),
    [evolution, quad]
  )

  // Merged once per part; the leg pairs then draw the same geometry twice.
  const torso = useMergedGroups(shape.torso)
  const head = useMergedGroups(shape.head)
  const tail = useMergedGroups(shape.tail)
  const front = useMergedGroups(shape.front)
  const back = useMergedGroups(shape.back)

  // Ref plumbing: assign into the shared rig if one was supplied.
  const assign = (key) => (node) => {
    if (rig) rig.current[key] = node
  }

  const frontHip = quad ? [0.5, 1.0, 0.46] : [0.66, 1.2, 0.5]

  return (
    <group>
      <group ref={assign('body')}>
        <PartMeshes groups={torso} materials={materials} />

        <group ref={assign('head')} position={HEAD_ORIGIN}>
          <PartMeshes groups={head} materials={materials} />
        </group>

        <group ref={assign('tail')} position={TAIL_ORIGIN}>
          <PartMeshes groups={tail} materials={materials} />
        </group>

        <group ref={assign('legFrontL')} position={[frontHip[0], frontHip[1], -frontHip[2]]}>
          <PartMeshes groups={front} materials={materials} />
        </group>
        <group ref={assign('legFrontR')} position={frontHip}>
          <PartMeshes groups={front} materials={materials} />
        </group>

        <group ref={assign('legBackL')} position={[-0.5, 1.06, -0.46]}>
          <PartMeshes groups={back} materials={materials} />
        </group>
        <group ref={assign('legBackR')} position={[-0.5, 1.06, 0.46]}>
          <PartMeshes groups={back} materials={materials} />
        </group>
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

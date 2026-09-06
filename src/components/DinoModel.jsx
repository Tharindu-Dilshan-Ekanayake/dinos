import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import ModelFallback from './ModelFallback.jsx'
import { buildFor } from '../data/builds.js'
import { stanceFor } from '../data/stance.js'

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
const CASTS_SHADOW = { body: true, belly: true, spike: true, mark: false, eye: false, pupil: false }

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
    /*
     * Markings. A dino in one flat body colour reads as a toy; the stripe down
     * a tiger or the blotches on a gecko are most of what makes an animal look
     * like a species rather than a shape. Falls back to a darkened body so a
     * tier that names no marking colour still gets a coherent one.
     */
    const mark = new THREE.MeshStandardMaterial({
      color: evolution.mark ?? evolution.spike,
      roughness: 0.66,
      flatShading: true,
      emissive: new THREE.Color(evolution.mark ?? evolution.spike),
      emissiveIntensity: glow * 0.5,
    })

    // Late stages glow from the inside rather than just wearing bright colours.
    if (glow > 0) {
      body.emissive = new THREE.Color(evolution.aura)
      body.emissiveIntensity = glow * 0.26
    }

    return { body, belly, spike, eye, pupil, mark }
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
    jaw: null,
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
 * The body's own stretch, applied to a box as it is described.
 *
 * Every number below was hand-tuned on one animal. Rather than re-tune them
 * thirteen times, a build stretches the frame they live in: longer along the
 * spine, deeper through the ribs, taller or lower off the ground. Boxes take
 * that without complaint, which is what makes a Triceratops and a Raptor cost
 * exactly the same as each other to draw.
 */
function stretcher(build) {
  return (material, [x, y, z], [sx, sy, sz], rotation) =>
    box(
      material,
      [x * build.length, y * build.height, z * build.girth],
      [sx * build.length, sy * build.height, sz * build.girth],
      rotation
    )
}

/**
 * Torso: a barrel chest over a pale belly, with the flank stripe that gives
 * every stage a second colour break along its side.
 */
function torsoBoxes(evolution, build) {
  const at = stretcher(build)
  const out = [
    // Deeper through the chest than it is long: a cartoon animal, not a lizard.
    at('body', [-0.18, 1.18, 0], [1.45, 1.28, 1.14]),
    at('body', [0.5, 1.28, 0], [0.8, 1.05, 1]),
    at('body', [-0.85, 1.12, 0], [0.8, 1, 1]),
    // Pale front, from throat to belly - the read that makes a shape look like
    // an animal rather than a block.
    at('belly', [-0.12, 0.76, 0], [1.5, 0.46, 0.94]),
    at('belly', [0.66, 1.04, 0], [0.58, 0.66, 0.84]),
  ]

  // The pale front carried a little way up each flank, rather than a bright
  // plate stuck on the side.
  for (const z of [-0.552, 0.552]) {
    out.push(at('belly', [-0.05, 1.0, z], [1.3, 0.42, 0.04]))
  }

  /*
   * The neck, which a build may draw out.
   *
   * A wyrm carries its head half a body-length in front of its shoulders and a
   * stegosaur carries it near the floor; without something bridging the gap the
   * head simply floated off the chest.
   */
  if (Math.abs(build.neckReach) > 0.01 || Math.abs(build.neckRise) > 0.01) {
    const steps = 3
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const taper = 1 - t * 0.28
      out.push(
        at(
          'body',
          [0.74 + build.neckReach * t, 1.32 + build.neckRise * t, 0],
          [0.46, 0.9 * taper, 0.9 * taper]
        )
      )
    }
  }

  /*
   * Markings.
   *
   * Each tier names a `pattern`, and the same three colours become a visibly
   * different animal depending on how they are laid on: bars across the back,
   * blotches down the flanks, or a single stripe from neck to hip. They sit a
   * hair proud of the body so the flat shading still catches them.
   */
  const pattern = evolution.pattern ?? 'none'

  if (pattern === 'stripes') {
    for (let i = 0; i < 4; i++) {
      const x = -0.72 + i * 0.44
      out.push(at('mark', [x, 1.5, 0], [0.16, 0.3, 1.16]))
      for (const z of [-0.58, 0.58]) {
        out.push(at('mark', [x, 1.12, z], [0.16, 0.62, 0.03]))
      }
    }
  } else if (pattern === 'spots') {
    const spots = [
      [-0.62, 1.42],
      [-0.1, 1.6],
      [0.36, 1.36],
      [-0.34, 1.06],
      [0.2, 0.98],
    ]
    for (const [x, y] of spots) {
      for (const z of [-0.575, 0.575]) {
        out.push(at('mark', [x, y, z], [0.3, 0.3, 0.02]))
      }
      out.push(at('mark', [x, 1.83, 0], [0.28, 0.02, 0.3]))
    }
  } else if (pattern === 'ridge') {
    // One band running the length of the spine, and a collar at the throat.
    out.push(at('mark', [-0.2, 1.83, 0], [2.1, 0.03, 0.4]))
    out.push(at('mark', [0.62, 1.28, 0], [0.16, 1.06, 1.02]))
  } else if (pattern === 'plated') {
    // Armour panels down each flank, the way a beetle's shell is segmented.
    for (let i = 0; i < 3; i++) {
      const x = -0.68 + i * 0.62
      for (const z of [-0.578, 0.578]) {
        out.push(at('mark', [x, 1.24, z], [0.5, 0.86, 0.02]))
      }
    }
  }

  out.push(...plateBoxes(evolution, build, at))
  return out
}

/**
 * What is growing out of its back.
 *
 * A single row of blades was doing duty as a stegosaur's plates, a spinosaur's
 * sail and a colossus's armour all at once, which is why none of the three
 * read as itself. Each build now says which of them it has.
 */
function plateBoxes(evolution, build, at) {
  const count = evolution.plates ?? 0
  const row = build.plateRow
  if (count <= 0 || row === 'none') return []

  const out = []
  const FROM = -0.8
  const TO = 0.8
  const along = (i) => (count === 1 ? 0.5 : i / (count - 1))

  if (row === 'sail') {
    /*
     * Joined, thin and tall, with a web between the spines: a fin rather than
     * a set of blades. The membrane is what makes it read as one structure.
     */
    const spineHeight = (t) => 1.55 * (0.32 + Math.sin(t * Math.PI) * 0.95)
    for (let i = 0; i < count; i++) {
      const t = along(i)
      const height = spineHeight(t)
      const x = FROM + t * (TO - FROM)
      out.push(at('spike', [x, 1.5 + height / 2, 0], [0.17, height, 0.15]))
      if (i > 0) {
        const prevT = along(i - 1)
        const prev = FROM + prevT * (TO - FROM)
        const web = Math.min(height, spineHeight(prevT)) * 0.82
        out.push(at('spike', [(x + prev) / 2, 1.5 + web / 2, 0], [x - prev, web, 0.08]))
      }
    }
    return out
  }

  if (row === 'double') {
    /*
     * Two staggered rows, which is what a stegosaur actually carries - and the
     * stagger is most of why it reads as plates rather than as a comb.
     */
    for (let i = 0; i < count; i++) {
      const t = along(i)
      const height = 0.72 * (0.45 + Math.sin(t * Math.PI) * 0.9)
      const side = i % 2 === 0 ? 1 : -1
      out.push(
        at('spike', [FROM + t * (TO - FROM), 1.52 + height / 2, side * 0.2], [0.4, height, 0.14])
      )
    }
    return out
  }

  // A single row of blades down the spine, as before.
  for (let i = 0; i < count; i++) {
    const t = along(i)
    const height = 0.5 * (0.4 + Math.sin(t * Math.PI) * 0.9)
    out.push(at('spike', [FROM + t * (TO - FROM), 1.55 + height / 2, 0], [0.22, height, 0.42]))
  }
  return out
}

/**
 * Muzzle stretch.
 *
 * A snout is not a scaled head - a crocodile is not a bulldog blown up. Only
 * what is forward of the eye socket is drawn out, so a spinosaur gets jaws and
 * a hatchling gets a face.
 */
const SNOUT_FROM = 0.6

function snouted(snout) {
  const push = (x) => (x <= SNOUT_FROM ? x : SNOUT_FROM + (x - SNOUT_FROM) * snout)
  return (material, [x, y, z], [sx, sy, sz], rotation) =>
    box(material, [push(x), y, z], [x > SNOUT_FROM ? sx * snout : sx, sy, sz], rotation)
}

/** The skull: braincase, cheeks, snout, eyes and the stage's headgear. */
function headBoxes(evolution, build) {
  const horns = evolution.horns ?? 0
  const at = snouted(build.snout)
  const out = [
    at('body', [0.0, -0.12, 0], [0.78, 0.76, 0.8]),
    // Skull, widened at the jaw hinge so the face is square rather than wedged.
    at('body', [0.54, 0.16, 0], [0.98, 0.88, 0.94]),
    at('body', [0.78, 0.58, 0], [0.66, 0.2, 1]),
    at('body', [1.18, 0.14, 0], [0.62, 0.44, 0.74]),
    at('body', [1.26, 0.38, 0], [0.46, 0.22, 0.56]),
    // The roof of the mouth, so an open jaw shows dark rather than daylight.
    at('pupil', [1.02, -0.09, 0], [0.86, 0.1, 0.68]),
  ]

  for (const z of [-0.48, 0.48]) {
    out.push(at('body', [0.66, -0.06, z], [0.66, 0.48, 0.1]))
    out.push(at('pupil', [1.47, 0.26, z * 0.36], [0.07, 0.1, 0.12]))
  }

  // Teeth along the upper jaw.
  for (const z of [-0.26, -0.09, 0.09, 0.26]) {
    out.push(at('eye', [1.36, -0.1, z], [0.11, 0.2, 0.11]))
  }

  // Eyes: white, pupil, and a highlight square sitting proud of the pupil.
  // Set into the skull's corner rather than pasted flat on its cheek.
  for (const z of [-0.42, 0.42]) {
    const outward = Math.sign(z)
    out.push(at('eye', [0.9, 0.36, z], [0.3, 0.32, 0.17]))
    // Wrapped around the outer front corner, so the dino is looking at you
    // from a three-quarter view instead of showing a blank white patch.
    out.push(at('pupil', [1.0, 0.34, z + outward * 0.035], [0.17, 0.23, 0.14]))
    out.push(at('eye', [1.04, 0.44, z + outward * 0.05], [0.08, 0.09, 0.08]))
  }

  /*
   * The frill: a shield with a scalloped rim rather than a plain slab, because
   * the notches round its edge are most of what says "triceratops" at a glance.
   * Built unstretched - a frill is behind the eyes, so the muzzle's length has
   * nothing to say about it.
   */
  if (evolution.frill) {
    out.push(box('spike', [0.16, 0.44, 0], [0.2, 1.02, 1.86]))
    for (const z of [-0.9, 0.9]) {
      out.push(box('spike', [0.16, 0.06, z], [0.2, 0.56, 0.36]))
    }
    for (const [z, h] of [
      [-0.74, 0.3],
      [-0.26, 0.42],
      [0.26, 0.42],
      [0.74, 0.3],
    ]) {
      out.push(box('spike', [0.16, 1.02, z], [0.18, h, 0.3]))
    }
  }

  if (horns >= 1) out.push(at('spike', [1.4, 0.52, 0], [0.2, 0.54, 0.2], [0, 0, -0.32]))
  if (horns >= 2) {
    for (const z of [-0.33, 0.33]) {
      out.push(at('spike', [0.74, 0.84, z], [0.18, 0.6, 0.18], [z > 0 ? -0.2 : 0.2, 0, -0.1]))
    }
  }
  if (horns >= 3) {
    for (const z of [-0.5, 0.5]) {
      out.push(box('spike', [0.4, 0.94, z], [0.16, 0.72, 0.16], [z > 0 ? -0.4 : 0.4, 0, 0.12]))
    }
  }

  return out
}

/**
 * Where the lower jaw swings from, in skull space.
 *
 * The jaw used to be a slab welded under the skull, so every dino in the game
 * had its mouth shut - including the ones whose entire character is the size of
 * what they can open. On its own hinge it takes a resting angle from the build,
 * and anything that wants to make an animal roar has a handle to pull.
 */
export const JAW_HINGE = [0.62, -0.12, 0]

/** The lower jaw: bone, pale underside, and a row of teeth. */
function jawBoxes(build) {
  const at = snouted(build.snout)
  // Described in skull space and then shifted onto the hinge, so the muzzle
  // stretch applies to the jaw exactly as it does to the face above it.
  const onHinge = (b) => ({
    ...b,
    position: [b.position[0] - JAW_HINGE[0], b.position[1] - JAW_HINGE[1], b.position[2]],
  })

  const out = [
    at('body', [1.0, -0.3, 0], [0.94, 0.22, 0.72]),
    at('belly', [1.02, -0.44, 0], [0.86, 0.16, 0.64]),
  ]
  for (const z of [-0.24, 0, 0.24]) {
    out.push(at('eye', [1.3, -0.12, z], [0.1, 0.18, 0.1]))
  }
  return out.map(onHinge)
}

/** Tail: a tapering chain, with the club or spikes some stages carry. */
function tailBoxes(evolution, build) {
  const out = []
  const count = 7
  const step = 0.36 * build.tailLength
  const girth = build.tailGirth

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    out.push(
      box(
        'body',
        [-0.34 * build.tailLength - i * step, -t * t * 0.42 * build.tailDroop, 0],
        [0.46 * build.tailLength, (0.52 - t * 0.34) * girth, (0.52 - t * 0.34) * girth]
      )
    )
  }

  const tipX = -0.34 * build.tailLength - (count - 0.4) * step
  const tipY = -0.42 * build.tailDroop
  // Rounded-off tip, so the tail ends rather than being cut short.
  out.push(box('body', [tipX, tipY, 0], [0.3, 0.2 * girth, 0.2 * girth]))

  if (evolution.tailSpikes) {
    out.push(box('spike', [tipX - 0.14, tipY - 0.02, 0], [0.54, 0.54, 0.54]))
    for (const z of [-0.38, 0.38]) {
      out.push(box('spike', [tipX - 0.24, tipY - 0.02, z], [0.34, 0.2, 0.32]))
    }
    out.push(box('spike', [tipX - 0.5, tipY - 0.02, 0], [0.36, 0.2, 0.32]))
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

/**
 * Blocky dino, restyled per stage. Faces +X, feet on y = 0.
 */
export function PrimitiveDino({ evolution, materials, rig }) {
  const build = useMemo(() => buildFor(evolution), [evolution])
  const stance = useMemo(() => stanceFor(evolution), [evolution])
  const quad = stance.quad

  const shape = useMemo(
    () => ({
      torso: torsoBoxes(evolution, build),
      head: headBoxes(evolution, build),
      jaw: jawBoxes(build),
      tail: tailBoxes(evolution, build),
      // Front and back limbs differ in build; both sides of a pair share one
      // description, and therefore one merged geometry.
      front: quad
        ? legBoxes(stance.frontLeg.thickness, stance.frontLeg.length, true)
        : armBoxes(),
      back: legBoxes(stance.backLeg.thickness, stance.backLeg.length, true),
    }),
    [evolution, build, stance, quad]
  )

  // Merged once per part; the leg pairs then draw the same geometry twice.
  const torso = useMergedGroups(shape.torso)
  const head = useMergedGroups(shape.head)
  const jaw = useMergedGroups(shape.jaw)
  const tail = useMergedGroups(shape.tail)
  const front = useMergedGroups(shape.front)
  const back = useMergedGroups(shape.back)

  // Ref plumbing: assign into the shared rig if one was supplied.
  const assign = (key) => (node) => {
    if (rig) rig.current[key] = node
  }

  const { frontHip, backHip } = stance

  // The head rides on the end of whatever neck this build has.
  const headOrigin = [
    (0.98 + build.neckReach) * build.length,
    (1.74 + build.neckRise) * build.height,
    0,
  ]
  const tailOrigin = [-0.9 * build.length, 1.12 * build.height, 0]

  /*
   * The hips are round numbers and the legs are not, so the feet landed a few
   * hundredths off the floor - a biped's *under* it. Shifting the whole animal
   * rather than its hips keeps the thighs socketed in the body exactly as
   * drawn; see data/stance.js.
   */
  return (
    <group position-y={stance.offset}>
      <group ref={assign('body')}>
        <PartMeshes groups={torso} materials={materials} />

        <group ref={assign('head')} position={headOrigin} scale={build.headSize}>
          <PartMeshes groups={head} materials={materials} />

          {/* Held open by however much of a mouth this animal is about. */}
          <group ref={assign('jaw')} position={JAW_HINGE} rotation-z={-build.jaw}>
            <PartMeshes groups={jaw} materials={materials} />
          </group>
        </group>

        <group ref={assign('tail')} position={tailOrigin}>
          <PartMeshes groups={tail} materials={materials} />
        </group>

        <group ref={assign('legFrontL')} position={[frontHip[0], frontHip[1], -frontHip[2]]}>
          <PartMeshes groups={front} materials={materials} />
        </group>
        <group ref={assign('legFrontR')} position={frontHip}>
          <PartMeshes groups={front} materials={materials} />
        </group>

        <group ref={assign('legBackL')} position={[backHip[0], backHip[1], -backHip[2]]}>
          <PartMeshes groups={back} materials={materials} />
        </group>
        <group ref={assign('legBackR')} position={backHip}>
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

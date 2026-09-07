import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import Text from '../SceneText.jsx'
import * as THREE from 'three'
import { buildPadDecor, onBelt, padRate, padUnlocked } from '../../data/training.js'
import { formatNumber } from '../../data/progression.js'
import { useGameStore } from '../../store/useGameStore.js'
import { playerPosition } from '../../systems/playerState.js'
import { voxelTexture } from '../../systems/voxelTexture.js'
import InstancedBlocks from '../InstancedBlocks.jsx'
import { DECAL } from '../../systems/decal.js'
import { shadeColor } from '../../data/areas.js'

/**
 * A training pad: stand on it and your dino trains, adding permanent Damage at
 * the pad's multiplier.
 *
 * The "am I standing on it" test and every bit of the pad's animation run from
 * useFrame against the shared player position, so a row of nine pads costs no
 * React renders while you walk the hub.
/**
 * How big a square you stand on.
 *
 * Long down the row rather than square, so ten of them read as a row of
 * platforms rather than a chessboard - but flat, with nothing standing on it.
 * See the render for why the machine that used to be here went away.
 */
const PAD_WIDTH = 4
const PAD_LENGTH = 6.2

/**
 * Lights chasing round the slab's rim, in the pad's own colour.
 *
 * A square that only changes *brightness* when you stand on it reads as a
 * lamp. What says *running* is something with a direction to it, so a string of
 * sparks travels the edge - a slow drift when the row is idle, a hard sprint
 * under a dino - and each pad runs them in its own accent, so the row lights up
 * as a ladder of colours rather than ten of the same square.
 *
 * One instanced mesh per pad: ten squares cost ten draws for the lot, and the
 * matrices are written in the frame loop the pad already runs.
 */
const CHASE_COUNT = 24
/** The rim they run, a hair outside the surface they light. */
const CHASE_X = PAD_WIDTH / 2 + 0.16
const CHASE_Z = PAD_LENGTH / 2 + 0.16
const CHASE_Y = 0.3

export default function TrainingPad({ pad, position }) {
  const rebirths = useGameStore((s) => s.rebirths)
  // What the sign promises is what the pad pays: your own damage per click,
  // times this machine's multiplier.
  const perClick = useGameStore((s) => s.perClick)
  const unlocked = padUnlocked(pad, rebirths)

  const padRef = useRef()
  const glowRef = useRef()
  const beamRef = useRef()
  const anim = useRef({ active: 0, phase: Math.random() * 6 })

  const materials = useMemo(() => {
    /*
     * The belt.
     *
     * The pad's studs are a *cloned* map so this one can scroll on its own -
     * the cache hands out shared textures, and offsetting a shared one would
     * set every pad in the row running at once. Cloning shares the image and
     * costs only its own offset.
     */
    /*
     * A locked pad wears its own colour too.
     *
     * The whole row used to grey out until you had the rebirths for it, so the
     * ladder you are meant to be climbing showed you eight identical slabs.
     * The rung is said by the sign and by whether the machine is *lit* - a
     * locked one is simply switched off.
     */
    const belt = voxelTexture(pad.color, {
      pattern: 'studs',
      cells: 4,
      variance: 0.05,
      fleckDepth: 0.24,
      repeat: [3, 3],
      seed: 77,
    }).clone()
    belt.needsUpdate = true

    const surface = new THREE.MeshStandardMaterial({
      map: belt,
      roughness: 0.55,
      flatShading: true,
      emissive: new THREE.Color(pad.accent),
      // Lit when it is yours, coloured either way.
      emissiveIntensity: unlocked ? 0.3 : 0.08,
    })
    const frame = new THREE.MeshStandardMaterial({
      color: pad.accent,
      roughness: 0.6,
      flatShading: true,
    })
    /*
     * The kerb round the pad, in a deeper cut of the pad's own colour.
     *
     * It was slate grey, which was right when it was the chassis of a machine
     * and wrong now that it is the border of a coloured square: ten grey kerbs
     * turned the row back into ten of the same thing seen from any distance
     * where the surface itself is foreshortened away.
     */
    const base = new THREE.MeshStandardMaterial({
      color: shadeColor(pad.accent, -0.35),
      roughness: 0.8,
      flatShading: true,
    })
    const lamp = new THREE.MeshStandardMaterial({
      color: pad.accent,
      emissive: new THREE.Color(pad.accent),
      // Switched off rather than repainted: an unlit lamp is what "locked"
      // looks like on a machine.
      emissiveIntensity: unlocked ? 0.9 : 0,
      roughness: 0.4,
      flatShading: true,
    })
    /*
     * The dressing standing around the machine. Two materials for the whole
     * thing however many pieces it has: the dark blocks it is built out of,
     * and the ones that glow.
     */
    const decorDull = new THREE.MeshStandardMaterial({
      color: '#3c4457',
      roughness: 0.9,
      flatShading: true,
    })
    const decorLit = new THREE.MeshStandardMaterial({
      color: pad.color,
      emissive: new THREE.Color(pad.accent),
      emissiveIntensity: unlocked ? 0.55 : 0,
      roughness: 0.5,
      flatShading: true,
    })

    return { surface, frame, base, lamp, belt, decorDull, decorLit }
  }, [pad, unlocked])

  /** Fixed for the life of the pad - the layout never changes, only its tint. */
  const chaseRef = useRef()
  const chase = useMemo(
    () => ({ phase: 0, matrix: new THREE.Matrix4(), position: new THREE.Vector3(), scale: new THREE.Vector3(), quaternion: new THREE.Quaternion() }),
    []
  )

  const decor = useMemo(() => buildPadDecor(pad.deco, pad.multiplier), [pad])
  const decorGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  useEffect(() => () => decorGeometry.dispose(), [decorGeometry])

  // The belt owns its cloned map, so it has to hand that back too - which is
  // why this walks the whole bundle rather than naming the materials.
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const a = anim.current
    a.phase += delta

    const dx = playerPosition.x - position[0]
    const dz = playerPosition.z - position[2]
    const standing = unlocked && onBelt(dx, dz)

    a.active += ((standing ? 1 : 0) - a.active) * Math.min(1, delta * 8)

    if (padRef.current) {
      materials.surface.emissiveIntensity =
        (unlocked ? 0.25 : 0) + a.active * (0.7 + Math.sin(a.phase * 6) * 0.2)
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = (unlocked ? 0.25 : 0.08) + a.active * 0.5
      glowRef.current.rotation.z += delta * (0.5 + a.active * 2.5)
    }
    if (beamRef.current) {
      beamRef.current.visible = a.active > 0.02
      beamRef.current.scale.set(1, 1 + Math.sin(a.phase * 4) * 0.12, 1)
      beamRef.current.material.opacity = a.active * 0.35
      beamRef.current.rotation.y += delta * 1.2
    }

    /*
     * The sparks. They run whether or not anybody is on the machine - a dead
     * row of treadmills is a row of furniture - but a dino on the belt takes
     * them from a drift to a sprint, and brightens them.
     */
    if (chaseRef.current) {
      chase.phase = (chase.phase + delta * (0.1 + a.active * 0.55)) % 1
      chase.quaternion.identity()

      /*
       * Walked round the rectangle rather than up two straight rails: the
       * perimeter is parameterised 0-1 and each spark sits at its own offset
       * along it, so they keep even spacing round the corners.
       */
      const perimeter = (PAD_WIDTH + PAD_LENGTH) * 2
      for (let i = 0; i < CHASE_COUNT; i++) {
        const t = ((i / CHASE_COUNT + chase.phase) % 1) * perimeter
        let x
        let z
        if (t < PAD_WIDTH) {
          x = -CHASE_X + t
          z = -CHASE_Z
        } else if (t < PAD_WIDTH + PAD_LENGTH) {
          x = CHASE_X
          z = -CHASE_Z + (t - PAD_WIDTH)
        } else if (t < PAD_WIDTH * 2 + PAD_LENGTH) {
          x = CHASE_X - (t - PAD_WIDTH - PAD_LENGTH)
          z = CHASE_Z
        } else {
          x = -CHASE_X
          z = CHASE_Z - (t - PAD_WIDTH * 2 - PAD_LENGTH)
        }

        const size = 0.16 + a.active * 0.16
        chase.position.set(x, CHASE_Y, z)
        chase.scale.set(size, size * 0.5, size)
        chase.matrix.compose(chase.position, chase.quaternion, chase.scale)
        chaseRef.current.setMatrixAt(i, chase.matrix)
      }

      chaseRef.current.instanceMatrix.needsUpdate = true
      chaseRef.current.material.opacity = unlocked ? 0.4 + a.active * 0.55 : 0.14
    }

    // The belt always creeps; standing on it winds it up to speed.
    if (unlocked) {
      materials.belt.offset.y -= delta * (0.06 + a.active * 0.55)
    }
  })

  const rate = padRate(pad, perClick)

  return (
    /*
     * Turned a quarter turn, so the slab's long axis runs toward the walkway
     * - the way you face while you are standing on it - and its short axis
     * along the row, which is what lets ten of them sit close together.
     */
    <group name="TrainingPad" position={position} rotation-y={-Math.PI / 2}>
      {/*
        A flat slab on the floor, not a machine.

        This was a full treadmill: chassis, side rails, rollers, a motor
        housing, a console on uprights and handrails running back from it. It
        looked like a treadmill and it read like *furniture* - ten of them made
        the right of the hub a showroom you walk between rather than a row of
        squares you stand on. The reference is a coloured slab with a number
        over it, and standing on it is the whole interaction.

        What is kept is everything that says the thing is *running*: the surface
        scrolls, the rim brightens as you step on, and the sparks chase round
        the edge in the pad's own colour.
      */}
      <mesh material={materials.base} position={[0, 0.07, 0]} receiveShadow>
        <boxGeometry args={[PAD_WIDTH + 0.5, 0.14, PAD_LENGTH + 0.5]} />
      </mesh>
      <mesh material={materials.frame} position={[0, 0.17, 0]} receiveShadow>
        <boxGeometry args={[PAD_WIDTH + 0.22, 0.1, PAD_LENGTH + 0.22]} />
      </mesh>
      <mesh ref={padRef} material={materials.surface} position={[0, 0.24, 0]} receiveShadow>
        <boxGeometry args={[PAD_WIDTH, 0.08, PAD_LENGTH]} />
      </mesh>

      {/*
        The pad's own dressing - bullion, crystals, a lava crust, ice spikes,
        whatever this rung of the ladder is. Two draws whatever it is made of,
        and all of it outside the belt so it never stands where the dino does.
      */}
      <InstancedBlocks
        items={decor.dull}
        geometry={decorGeometry}
        material={materials.decorDull}
        castShadow
        receiveShadow
      />
      <InstancedBlocks
        items={decor.lit}
        geometry={decorGeometry}
        material={materials.decorLit}
        castShadow
      />

      {/* Sparks running the rim - see CHASE_COUNT. */}
      <instancedMesh
        ref={chaseRef}
        args={[undefined, undefined, CHASE_COUNT]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color={pad.accent}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          {...DECAL}
          toneMapped={false}
          fog={false}
        />
      </instancedMesh>

      <mesh ref={glowRef} position={[0, 0.3, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.5, 2.1, 24]} />
        <meshBasicMaterial
          color={pad.accent}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
          {...DECAL}
          fog={false}
        />
      </mesh>

      {/* Column of light while training */}
      <mesh ref={beamRef} position={[0, 2.6, 0]} visible={false}>
        <cylinderGeometry args={[1.5, 1.1, 5, 6, 1, true]} />
        <meshBasicMaterial
          color={pad.accent}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          {...DECAL}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </mesh>

      {/*
        The number floating over the slab, with no post under it and no board
        behind it - the same treatment the gallery's labels get, because they
        are the same kind of thing: a label on the square, not a sign beside it.
      */}
      <Billboard position={[0, 2.5, 0]}>
        <Text
          position={[0, 0.3, 0]}
          fontSize={0.42}
          color={pad.color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.058}
          outlineColor="#12100e"
        >
          {`x${pad.multiplier} Damage`}
        </Text>

        <Text
          position={[0, -0.14, 0]}
          fontSize={0.3}
          color={unlocked ? '#86efac' : '#fca5a5'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.045}
          outlineColor="#12100e"
        >
          {unlocked
            ? `+${formatNumber(rate)}/sec`
            : `${pad.requiresRebirths} Rebirth${pad.requiresRebirths === 1 ? '' : 's'}`}
        </Text>
      </Billboard>

    </group>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Text from '../SceneText.jsx'
import HeadlineText from '../HeadlineText.jsx'
import { EVOLUTIONS } from '../../data/evolutions.js'
import { HUB_BOARD } from '../../data/lobby.js'
import { formatNumber } from '../../data/progression.js'
import { useGameStore } from '../../store/useGameStore.js'
import { leaderboardEnabled, subscribeLeaderboard } from '../../systems/leaderboard.js'
import MergedBoxes, { mergeBoxes } from '../MergedBoxes.jsx'

/**
 * The board that names the place.
 *
 * A hub with no sign in it is a field with props on it. This is the one piece
 * of the world that says what the game is: a lit screen on two posts carrying
 * the title and the standings. It stands over the treadmill row facing down it,
 * so it is what you are looking at for the whole time you are training - which
 * is the longest anybody stands still in this game.
 *
 * The screen shows the shared leaderboard when a server is configured and your
 * own records when one is not, because most builds have no server and a board
 * that is permanently empty is worse than no board.
 */

/** How many places fit on the screen. */
const ROWS = 5

/** The middle of the screen, which everything on the board is measured from. */
const SCREEN_Y = 8.9
/** Where the standings start, and how far apart the lines sit. */
const FIRST_ROW_Y = 9.5
const ROW_STEP = 1.05

/**
 * The bezel, in colour.
 *
 * A single blue bar read as a monitor bought from an office. Segments in the
 * game's own arcade colours, chasing along the top and bottom, make it a sign
 * over a gym - and they are the same trick the treadmills below run down their
 * rails, so the whole corner of the hub pulses together.
 */
const BEZEL = ['#ff5d8f', '#ffb703', '#8ef6a0', '#4cc9f0', '#b388ff']
const SEGMENTS = 10

/** The frame, as boxes. One set of buffers, a handful of draws. */
const FRAME = mergeBoxes([
  // Two legs on footings.
  ...[-1, 1].flatMap((side) => [
    { material: 'post', position: [side * 7.4, 3.6, 0], size: [0.9, 7.2, 0.9], shadow: true },
    { material: 'trim', position: [side * 7.4, 0.35, 0], size: [1.6, 0.7, 1.6], shadow: true },
    // A brace back to the screen, so the legs read as carrying something.
    { material: 'trim', position: [side * 6.5, 6.6, 0], size: [1.4, 0.4, 0.5] },
  ]),

  // The screen's surround: a slab with a lip all the way round it.
  { material: 'trim', position: [0, SCREEN_Y, -0.28], size: [16.4, 8.6, 0.5], shadow: true },
  { material: 'screen', position: [0, SCREEN_Y, 0.02], size: [15.4, 7.9, 0.12] },

  // A hood over the top, which is most of what makes a screen read as lit
  // rather than as a painted board.
  { material: 'post', position: [0, 13.4, 0.5], size: [17, 0.5, 1.6], shadow: true },
])

/**
 * The bezel segments, one merged set per colour.
 *
 * Split by colour rather than by position so the whole strip is five draws
 * however many segments it has, and each colour can be lit on its own beat.
 */
const BEZEL_STRIPS = BEZEL.map((_, colour) =>
  mergeBoxes(
    Array.from({ length: SEGMENTS }, (_, i) => i)
      .filter((i) => i % BEZEL.length === colour)
      .flatMap((i) => {
        const width = 15.6 / SEGMENTS
        const x = -7.8 + width * (i + 0.5)
        return [-1, 1].map((side) => ({
          material: 'lit',
          position: [x, SCREEN_Y + side * 4.05, 0.06],
          size: [width - 0.12, 0.3, 0.18],
        }))
      })
  )
)

/** One line of the standings. */
function Row({ index, place, name, value }) {
  return (
    <group position={[0, -index * ROW_STEP, 0]}>
      <Text
        position={[-6.6, 0, 0.1]}
        fontSize={0.62}
        color="#ffd166"
        anchorX="left"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#12071f"
      >
        {place}
      </Text>
      <Text
        position={[-5.3, 0, 0.1]}
        fontSize={0.58}
        color="#f2ecff"
        anchorX="left"
        anchorY="middle"
        maxWidth={8}
        outlineWidth={0.045}
        outlineColor="#12071f"
      >
        {name}
      </Text>
      <Text
        position={[6.6, 0, 0.1]}
        fontSize={0.58}
        color="#8ef6a0"
        anchorX="right"
        anchorY="middle"
        outlineWidth={0.045}
        outlineColor="#12071f"
      >
        {value}
      </Text>
    </group>
  )
}

export default function HubBoard() {
  const [board, setBoard] = useState(() => ({ status: 'offline', entries: [] }))
  const wins = useGameStore((s) => s.lifetimeWins)
  const rebirths = useGameStore((s) => s.rebirths)
  const bestStage = useGameStore((s) => s.bestStage)
  const glow = useRef()

  /*
   * Read-only. The HUD's Leaderboard owns the connection - it is the thing that
   * knows the player's name and pushes their score - so this only listens, and
   * shows nothing of its own when there is no server.
   */
  useEffect(() => {
    if (!leaderboardEnabled) return undefined
    return subscribeLeaderboard(setBoard)
  }, [])

  const materials = useMemo(
    () => ({
      post: new THREE.MeshStandardMaterial({ color: '#ffb703', roughness: 0.6, flatShading: true }),
      trim: new THREE.MeshStandardMaterial({ color: '#5b21b6', roughness: 0.65, flatShading: true }),
      screen: new THREE.MeshStandardMaterial({
        color: '#1b0f3b',
        roughness: 0.35,
        flatShading: true,
        emissive: new THREE.Color('#2a1a6b'),
        emissiveIntensity: 1,
      }),
    }),
    []
  )

  // One material per bezel colour, lit on its own beat.
  const bezelMaterials = useMemo(
    () =>
      BEZEL.map(
        (colour) =>
          new THREE.MeshStandardMaterial({
            color: colour,
            roughness: 0.28,
            flatShading: true,
            emissive: new THREE.Color(colour),
            emissiveIntensity: 1,
            toneMapped: false,
          })
      ),
    []
  )

  useEffect(
    () => () => {
      Object.values(materials).forEach((m) => m.dispose())
      bezelMaterials.forEach((m) => m.dispose())
    },
    [materials, bezelMaterials]
  )

  useFrame((state) => {
    /*
     * The colours light in turn rather than all together, which is what makes
     * the strip read as running round the screen instead of simply flashing.
     */
    const t = state.clock.elapsedTime
    bezelMaterials.forEach((m, i) => {
      m.emissiveIntensity = 0.5 + Math.sin(t * 2.4 - i * 1.1) * 0.45
    })
    if (glow.current) glow.current.material.opacity = 0.14 + Math.sin(t * 2.4) * 0.05
  })

  /*
   * The standings, or your own records when there is no server to rank you
   * against. Both are things worth reading; an empty top-five is not.
   */
  const rows = leaderboardEnabled
    ? board.entries.slice(0, ROWS).map((entry, i) => ({
        place: `${i + 1}`,
        name: entry.name || 'Anonymous Dino',
        value: `${formatNumber(entry.wins ?? 0)} wins`,
      }))
    : [
        { place: '', name: 'Lifetime wins', value: formatNumber(wins) },
        { place: '', name: 'Rebirths', value: `${rebirths}` },
        { place: '', name: 'Best stage', value: `${bestStage + 1}` },
        { place: '', name: 'Dinos owned', value: `${EVOLUTIONS.length}` },
      ]

  const heading = leaderboardEnabled ? 'Top Dinos' : 'Your Records'

  return (
    <group position={HUB_BOARD.position} rotation-y={HUB_BOARD.rotationY}>
      <MergedBoxes groups={FRAME} materials={materials} />
      {BEZEL_STRIPS.map((strip, i) => (
        <MergedBoxes key={BEZEL[i]} groups={strip} materials={{ lit: bezelMaterials[i] }} />
      ))}

      {/* Light spilling off the screen onto the paving in front of it. */}
      <mesh ref={glow} position={[0, 0.06, 4]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[17, 8]} />
        <meshBasicMaterial
          color="#b388ff"
          transparent
          opacity={0.14}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      {/* The title, in the same chunky lettering the arena gates use. */}
      <group position={[0, 11.95, 0.14]}>
        <HeadlineText size={1.12} y={0} shadow="#12071f">
          +1 DINO EVOLUTION
        </HeadlineText>
      </group>

      <Text
        position={[0, 10.65, 0.14]}
        fontSize={0.56}
        color="#4cc9f0"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#12071f"
      >
        {heading.toUpperCase()}
      </Text>

      <group position={[0, FIRST_ROW_Y, 0.14]}>
        {rows.map((row, i) => (
          <Row key={row.name} index={i} {...row} />
        ))}
      </group>
    </group>
  )
}

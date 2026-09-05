import { Text } from '@react-three/drei'

/**
 * A line of chunky cartoon lettering: a dark copy sunk behind a bright one.
 *
 * troika's outline gives a crisp border but no depth, and the two together are
 * what make a word read as moulded rather than as a label pasted onto the air.
 *
 * Shared by both ends of the corridor - the hub's staircase and every gate in
 * the arena - so "Stage 4" is the same object wherever the game says it.
 */
export default function HeadlineText({
  children,
  size,
  color = '#ffffff',
  y = 0,
  shadow = '#141020',
}) {
  const shared = {
    fontSize: size,
    anchorX: 'center',
    anchorY: 'middle',
    outlineWidth: size * 0.1,
    outlineColor: shadow,
  }

  return (
    <>
      <Text {...shared} position={[0, y - size * 0.07, -0.02]} color={shadow}>
        {children}
      </Text>
      <Text {...shared} position={[0, y, 0]} color={color}>
        {children}
      </Text>
    </>
  )
}

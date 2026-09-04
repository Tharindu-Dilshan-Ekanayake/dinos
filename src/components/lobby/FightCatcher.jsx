import { useGameStore } from '../../store/useGameStore.js'
import { PLAZA } from '../../data/lobby.js'

/**
 * Left-click to fight.
 *
 * An invisible backdrop behind everything else turns a left click anywhere on
 * the view into an attack. `colorWrite={false}` means it never touches a pixel
 * while staying visible to the raycaster - unlike `visible={false}`, which
 * three.js skips entirely.
 *
 * It sits at the very back, so podiums and pedestals in front of it win the
 * hit test and keep their own handlers. Right-clicks are ignored here: those
 * belong to the orbit camera.
 */
export default function FightCatcher() {
  const attack = useGameStore((s) => s.attack)

  return (
    <mesh
      position={[0, 6, PLAZA.to - 12]}
      onPointerDown={(e) => {
        if (e.nativeEvent.button !== 0) return
        e.stopPropagation()
        attack(undefined, [e.nativeEvent.clientX, e.nativeEvent.clientY])
      }}
    >
      <planeGeometry args={[400, 220]} />
      <meshBasicMaterial colorWrite={false} depthWrite={false} />
    </mesh>
  )
}

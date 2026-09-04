import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * The sun, built out of blocks like everything else.
 *
 * A gradient sky with nothing in it reads as a backdrop; one bright object up
 * there turns it into a time of day. It sits in the key light's direction, so
 * the shadows on the ground actually point away from it, and the stage's mood
 * decides how high and how big it hangs - small and white overhead at noon,
 * huge and orange on the horizon at dusk.
 *
 * Unlit and fog-exempt, like the clouds and the skyline: it is further out
 * than the fog's far plane and is supposed to be the brightest thing in frame.
 */

/**
 * Direction of the key light in both scenes, as an angle around Y from +Z.
 *
 * The arena's key sits at (+6, 14, +8) from the player and the hub's at
 * (+18, 30, +22) - near enough the same bearing that one sun serves both.
 */
export const SUN_AZIMUTH = Math.atan2(6, 8)

/** A chunky ball: a centre cube with one cube stuck on each face. */
function voxelBallGeometry() {
  const parts = [new THREE.BoxGeometry(1, 1, 1)]
  const arm = 0.62

  for (const axis of [0, 1, 2]) {
    for (const sign of [-1, 1]) {
      const geometry = new THREE.BoxGeometry(
        axis === 0 ? arm : 0.72,
        axis === 1 ? arm : 0.72,
        axis === 2 ? arm : 0.72
      )
      geometry.translate(
        axis === 0 ? sign * 0.72 : 0,
        axis === 1 ? sign * 0.72 : 0,
        axis === 2 ? sign * 0.72 : 0
      )
      parts.push(geometry)
    }
  }

  const merged = mergeGeometries(parts, false)
  parts.forEach((geometry) => geometry.dispose())
  return merged
}

export default function SkyBody({
  color = '#fff4c9',
  elevation = 0.7,
  size = 7,
  azimuth = SUN_AZIMUTH,
  distance = 92,
  glow = 1.7,
}) {
  const geometry = useMemo(() => voxelBallGeometry(), [])

  const materials = useMemo(
    () => ({
      core: new THREE.MeshBasicMaterial({ fog: false, toneMapped: false }),
      // A soft halo, drawn additively so it brightens the sky around it
      // instead of sitting on it as a flat disc.
      halo: new THREE.MeshBasicMaterial({
        fog: false,
        toneMapped: false,
        transparent: true,
        opacity: 0.11,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    }),
    []
  )

  useEffect(
    () => () => {
      geometry.dispose()
      Object.values(materials).forEach((m) => m.dispose())
    },
    [geometry, materials]
  )

  /*
   * The colour is held by reference when a live THREE.Color is handed in, so a
   * caller lerping between stages recolours the sun without a re-render.
   */
  useEffect(() => {
    if (color instanceof THREE.Color) {
      materials.core.color = color
      materials.halo.color = color
    } else {
      materials.core.color.set(color)
      materials.halo.color.set(color)
    }
  }, [color, materials])

  const position = useMemo(() => {
    const angle = elevation * (Math.PI / 2)
    const flat = Math.cos(angle) * distance
    return [Math.sin(azimuth) * flat, Math.sin(angle) * distance, Math.cos(azimuth) * flat]
  }, [azimuth, elevation, distance])

  return (
    <group position={position}>
      <mesh geometry={geometry} material={materials.core} scale={size} />
      <mesh geometry={geometry} material={materials.halo} scale={size * glow} />
    </group>
  )
}

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { ARENA, buildArenaBlocks, buildArenaProps, buildGlowVeins } from '../../data/arena.js'
import ArenaProps from './ArenaProps.jsx'

/**
 * One level's chamber, drawn at its own place in the corridor.
 *
 * Unlike the old single re-themed arena, a chamber's palette never changes: it
 * belongs to one level for the life of the run. That means no per-frame colour
 * lerping here at all, and it is what lets you see the *next* level's colours
 * through the gate before you walk into them.
 */

/**
 * World-space checker injected into a standard material.
 *
 * Done through onBeforeCompile rather than a bespoke ShaderMaterial so the
 * floor keeps real lighting, shadows and fog - all the things a hand-written
 * shader would have to reimplement.
 */
function makeCheckerMaterial(colorA, colorB, tileSize) {
  const material = new THREE.MeshStandardMaterial({ color: colorA, roughness: 0.94 })

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCheckerColor = { value: new THREE.Color(colorB) }
    shader.uniforms.uTileSize = { value: tileSize }

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vArenaWorldPos;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvArenaWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 uCheckerColor;\nuniform float uTileSize;\nvarying vec3 vArenaWorldPos;'
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         vec2 tile = floor(vArenaWorldPos.xz / uTileSize);
         float checker = mod(tile.x + tile.y, 2.0);
         diffuseColor.rgb = mix(diffuseColor.rgb, uCheckerColor, checker);`
      )
  }

  material.customProgramCacheKey = () => `arena-checker-${tileSize}`
  return material
}

export default function Chamber({ palette, origin }) {
  const blocks = useMemo(() => buildArenaBlocks(), [])
  const props = useMemo(() => buildArenaProps(blocks), [blocks])
  const veins = useMemo(() => buildGlowVeins(), [])

  const materials = useMemo(() => {
    const floor = makeCheckerMaterial(palette.floorA, palette.floorB, ARENA.tileSize)
    return {
      floor,
      pad: new THREE.MeshStandardMaterial({ color: palette.floorEdge, roughness: 0.8 }),
      // A material per tier so the walls read as depth, not a flat mass.
      cliffNear: new THREE.MeshStandardMaterial({ color: palette.cliff, roughness: 0.95 }),
      cliffFar: new THREE.MeshStandardMaterial({ color: palette.cliffDark, roughness: 0.95 }),
      cliffCap: new THREE.MeshStandardMaterial({ color: palette.cliffTop, roughness: 0.9 }),
      glow: new THREE.MeshBasicMaterial({
        color: palette.glow,
        transparent: true,
        opacity: palette.glowStrength * 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    }
  }, [palette])

  const geometries = useMemo(
    () => ({ block: new THREE.BoxGeometry(1, 1, 1), vein: new THREE.PlaneGeometry(1, 1) }),
    []
  )

  const propColors = useMemo(
    () => ({
      main: new THREE.Color(palette.propColor),
      accent: new THREE.Color(palette.propAccent),
    }),
    [palette]
  )

  useEffect(
    () => () => {
      Object.values(materials).forEach((m) => m.dispose())
      Object.values(geometries).forEach((g) => g.dispose())
    },
    [materials, geometries]
  )

  return (
    <group position={[0, 0, origin]}>
      {/* Floor. Sized to reach the neighbouring chambers so the corridor
          never shows a seam of empty space between levels. */}
      <mesh rotation-x={-Math.PI / 2} material={materials.floor} receiveShadow>
        <planeGeometry args={[110, 96]} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position-y={0.02} material={materials.pad} receiveShadow>
        <ringGeometry args={[ARENA.padRadius - 0.7, ARENA.padRadius, 56]} />
      </mesh>

      {palette.glowStrength > 0 &&
        veins.map((vein, i) => (
          <mesh
            key={i}
            geometry={geometries.vein}
            material={materials.glow}
            position={vein.position}
            rotation={[-Math.PI / 2, 0, vein.rotation]}
            scale={[vein.width, vein.length, 1]}
          />
        ))}

      {blocks.map((block, i) => (
        <group key={i}>
          <mesh
            geometry={geometries.block}
            material={block.tier === 0 ? materials.cliffNear : materials.cliffFar}
            position={block.position}
            scale={block.size}
            castShadow
            receiveShadow
          />
          <mesh
            geometry={geometries.block}
            material={materials.cliffCap}
            position={[block.position[0], block.top + 0.16, block.position[2]]}
            scale={[block.size[0] * 1.005, 0.32, block.size[2] * 1.005]}
            receiveShadow
          />
        </group>
      ))}

      <ArenaProps
        items={props}
        kind={palette.prop}
        colorMain={propColors.main}
        colorAccent={propColors.accent}
      />
    </group>
  )
}

import * as THREE from 'three'

/**
 * Bloom, faked.
 *
 * A real bloom pass reads the rendered frame back, thresholds the bright
 * pixels and blurs them into the picture a second time - a whole extra
 * render target and composite step, and one this canvas cannot afford
 * without either adding a post-processing library or fighting the
 * logarithmic depth buffer the main camera already relies on (see App.jsx).
 *
 * A soft round sprite, additively blended and drawn unlit in front of
 * whatever glowing thing it sits on, buys almost the same read - a source
 * that looks brighter than the surface it is sitting on - for the cost of
 * one extra billboard per glowing object. It is the same trick the hub
 * already leans on for a single emissive material (`toneMapped: false`
 * skips the display curve for one surface); this is that idea turned into a
 * few extra soft pixels around it.
 */

let glowTextureCache = null

/** A radial gradient, opaque at the centre and fully transparent at the rim. */
function glowTexture() {
  if (glowTextureCache) return glowTextureCache

  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  )
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.55)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  glowTextureCache = texture
  return texture
}

/**
 * A cached material per colour - sprites with identical colour and blending
 * share a material the same way the voxel textures share theirs, so a dozen
 * glowing objects cost a dozen sprites and one shader program between them.
 */
const materialCache = new Map()

export function glowMaterial(color) {
  const hit = materialCache.get(color)
  if (hit) return hit
  const material = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    // Additive blending is already how a real bloom reads as "brighter than
    // the scene"; running it back through the tone-mapping curve on top of
    // that flattens it straight back down to the base surface colour.
    toneMapped: false,
    fog: false,
  })
  materialCache.set(color, material)
  return material
}

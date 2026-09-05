import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import InstancedBlocks from './InstancedBlocks.jsx'

/**
 * Blocky clouds ringing the horizon.
 *
 * A gradient dome alone reads as an empty backdrop; a handful of chunky white
 * slabs sitting in it gives the sky the same built-from-blocks language as the
 * ground, and tells the eye how far away the horizon is.
 *
 * Fog is off on purpose. These sit further out than the fog's far plane, so
 * with fog on they would dissolve into it and there would be no point drawing
 * them at all - the skydome they hang in ignores fog for the same reason.
 */

/** Deterministic LCG - the same sky on every load. */
function makeRandom(seed) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

/** The radius the clouds were originally drawn and sized at. */
const REFERENCE_RADIUS = 78

function buildClouds(count, radius, height, seed) {
  const rand = makeRandom(seed)
  const blocks = []
  /*
   * Pushed out past the fog so the corridor can be seen down its whole length
   * without cloud in it, and scaled by the same factor - height included, or
   * the whole cover slides down onto the horizon - so the sky overhead comes
   * out looking exactly as it did.
   */
  const scale = radius / REFERENCE_RADIUS

  for (let i = 0; i < count; i++) {
    // Spread around the ring, then jittered so the spacing is not a clock face.
    const angle = ((i + rand() * 0.7) / count) * Math.PI * 2
    const distance = radius * (0.78 + rand() * 0.42)
    const cx = Math.cos(angle) * distance
    const cz = Math.sin(angle) * distance
    const cy = height * scale * (0.7 + rand() * 0.6)
    const bulk = 0.8 + rand() * 0.8

    // Each cloud is a few slabs shoved together, biggest first. They overlap
    // on purpose: spread any further and a cloud reads as litter rather than
    // as one mass.
    const pieces = 3 + Math.floor(rand() * 3)
    for (let p = 0; p < pieces; p++) {
      const taper = 1 - p / (pieces + 2)
      blocks.push({
        position: [
          cx + (rand() - 0.5) * 6.5 * bulk * scale,
          cy + (rand() - 0.5) * 1.6 * scale,
          cz + (rand() - 0.5) * 6.5 * bulk * scale,
        ],
        scale: [
          (6 + rand() * 6) * bulk * taper * scale,
          (2.6 + rand() * 1.8) * taper * scale,
          (6 + rand() * 5) * bulk * taper * scale,
        ],
        rotation: rand() * Math.PI,
      })
    }
  }

  return blocks
}

export default function VoxelClouds({
  color = '#ffffff',
  count = 13,
  radius = 78,
  height = 34,
  opacity = 0.92,
  seed = 8675309,
}) {
  const clouds = useMemo(() => buildClouds(count, radius, height, seed), [count, radius, height, seed])

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const material = useMemo(() => {
    const next = new THREE.MeshLambertMaterial({
      // Mostly self-lit: a cloud that darkens on its shadowed side reads as a
      // floating rock, not weather.
      emissiveIntensity: 0.55,
      transparent: opacity < 1,
      opacity,
      fog: false,
    })

    if (color instanceof THREE.Color) {
      // Held by reference, so a caller lerping this Color between biomes
      // recolours the sky without remounting anything.
      next.color = color
      next.emissive = color
    } else {
      next.color.set(color)
      next.emissive.set(color)
    }

    return next
  }, [color, opacity])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material]
  )

  return <InstancedBlocks items={clouds} geometry={geometry} material={material} />
}

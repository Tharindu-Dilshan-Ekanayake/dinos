import { forwardRef } from 'react'
import { glowMaterial } from '../systems/glow.js'

/**
 * One soft additive billboard - the fake-bloom halo for a single glowing
 * object. See systems/glow.js for why this exists instead of a real bloom
 * pass.
 *
 * The material is cached and shared per colour, so two glows of the same
 * tint are one shader program between them - which means it must never be
 * mutated per instance. Anything that wants to pulse or fade a glow animates
 * this component's own `scale` instead (forwarded here for exactly that),
 * the same way the rest of the hub already animates a ring's opacity or a
 * lantern's emissive intensity from a ref in its own `useFrame`.
 */
const GlowSprite = forwardRef(function GlowSprite(
  { position, size = 1, color = '#ffffff' },
  ref
) {
  return (
    <sprite ref={ref} position={position} scale={[size, size, 1]} material={glowMaterial(color)} />
  )
})

export default GlowSprite

/**
 * Surfaces that lie *on* another surface.
 *
 * A depth buffer stores distance with finite precision, and almost all of that
 * precision is spent on the first few units in front of the camera. Forty units
 * out - the far side of the plaza, most of a chamber - two surfaces a centimetre
 * apart land in the same depth value, and which one wins is decided per pixel by
 * floating-point noise. As the camera moves the winner flickers. That is
 * z-fighting, and the hub had it everywhere: the concourse sits 0.01 above the
 * kerb it is painted on, the grass lanes 0.02 above that, tier tops 0.01 above
 * their tiers.
 *
 * Two things fix it, and this game does both:
 *
 *  1. `near` on the camera moved from 0.1 to 0.5, which is five times the
 *     precision at every distance and costs nothing, because nothing is ever
 *     within half a unit of an orbit camera that sits ten units out.
 *
 *  2. This. A polygon offset biases a surface's depth toward the camera as it
 *     is rasterised, so an overlay wins its pixels by *decision* rather than by
 *     arithmetic that happens to round its way. The offset is applied in depth
 *     units rather than world units, so it works at any distance, and it
 *     changes nothing about where the surface actually is.
 *
 * Use it on anything painted onto something else: paving over a slab, a glow
 * ring on the floor, a carpet on a ramp. Not on things with real thickness -
 * they are separated by their own geometry, and biasing them would let them
 * poke through whatever they are sitting inside.
 */
export const DECAL = {
  polygonOffset: true,
  /** Scaled by the surface's slope, which is what handles the ramp. */
  polygonOffsetFactor: -2,
  /** A flat bias, for the coplanar case where the slope term is zero. */
  polygonOffsetUnits: -2,
}

/**
 * A decal that lies on top of another decal.
 *
 * The plaza stacks three: kerb, then concourse, then the grass lanes. Two
 * layers need two different biases or they fight each other instead.
 */
export const DECAL_ABOVE = {
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4,
}

/**
 * A decal on top of a decal that is itself on top of a decal.
 *
 * The approach path stacks three: concourse, the road surface, then the kerb
 * line down its edges. `DECAL_ABOVE` is already spoken for by the grass lanes
 * at the middle tier, so the kerb needs a bias stronger than either.
 */
export const DECAL_TOP = {
  polygonOffset: true,
  polygonOffsetFactor: -6,
  polygonOffsetUnits: -6,
}

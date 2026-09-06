/**
 * What kind of animal each tier is, as opposed to what colour it is.
 *
 * Every dino in the game was one barrel-chested body with a few things bolted
 * on: the same torso, the same neck, the same head, the same tail, whether it
 * was called a Hatchling or a Triceratops. Colour and markings did the whole
 * job of telling them apart, so the gallery read as one animal in thirteen
 * paint jobs - and a "Stegosaur" that is a Rex with plates on it is not really
 * a stegosaur.
 *
 * A build is a set of proportions. The numbers are multipliers on the shape
 * DinoModel already described, so 1 everywhere is exactly the old dino and
 * every value is readable as "longer than", "lower than", "bigger-headed
 * than". Boxes take non-uniform scaling without complaint, which is what makes
 * this cheap: no new geometry, no new draw calls, thirteen silhouettes.
 */

/** Every knob, at the value that reproduces the original shape. */
const DEFAULTS = {
  /** Torso length, along the spine. */
  length: 1,
  /** Torso height. */
  height: 1,
  /** Torso width and depth. */
  girth: 1,

  /** How far forward the head is carried, and how high. */
  neckReach: 0,
  neckRise: 0,

  /** Head size, and how far the snout is drawn out of it. */
  headSize: 1,
  snout: 1,
  /** How far the lower jaw hangs open, in radians. A roar, held. */
  jaw: 0,

  /** Tail length, thickness, and how far it sags toward the tip. */
  tailLength: 1,
  tailGirth: 1,
  tailDroop: 1,

  /** Leg length, and how far apart the feet are planted. */
  legLength: 1,
  stance: 1,

  /**
   * How the back plates are laid out.
   *
   *   single  one row down the spine, as before
   *   double  two staggered rows - what a stegosaur actually has
   *   sail    tall, thin, joined: a spinosaur's fin
   *   none    a smooth back
   */
  plateRow: 'single',
}

/**
 * The builds themselves.
 *
 * Named for the animal rather than the tier, because several tiers share one:
 * a Magma Tyrant is a Rex that has been on fire, and it should be shaped like
 * one.
 */
export const BUILDS = {
  /** Small, round and top-heavy - a baby is mostly head. */
  hatchling: {
    length: 0.82,
    height: 0.94,
    girth: 1.06,
    headSize: 1.18,
    snout: 0.78,
    neckRise: 0.06,
    tailLength: 0.68,
    tailGirth: 1.1,
    legLength: 0.86,
    plateRow: 'single',
  },

  /** Long, low and quick: a runner built around a stiff counterweight tail. */
  raptor: {
    length: 1.08,
    height: 0.88,
    girth: 0.84,
    headSize: 0.86,
    snout: 1.18,
    jaw: 0.2,
    neckReach: 0.12,
    tailLength: 1.3,
    tailGirth: 0.8,
    tailDroop: 0.35,
    legLength: 1.12,
    stance: 0.86,
    plateRow: 'none',
  },

  /** Deep barrel body, a head that barely clears the ground, and the plates. */
  stego: {
    length: 1.04,
    height: 1.12,
    girth: 1.18,
    headSize: 0.7,
    snout: 0.9,
    neckRise: -0.42,
    neckReach: 0.1,
    tailLength: 1.05,
    tailGirth: 1.15,
    legLength: 0.96,
    stance: 1.15,
    plateRow: 'double',
  },

  /** All the weight at the front, under a shield and three horns. */
  trike: {
    length: 0.94,
    height: 1.04,
    girth: 1.16,
    headSize: 1.22,
    snout: 0.86,
    neckRise: -0.2,
    tailLength: 0.72,
    tailGirth: 1.2,
    legLength: 0.9,
    stance: 1.2,
    plateRow: 'none',
  },

  /** A walking roof: as wide as it is long, and almost no daylight under it. */
  anky: {
    length: 1,
    height: 0.82,
    girth: 1.32,
    headSize: 0.82,
    snout: 0.78,
    neckRise: -0.4,
    tailLength: 0.95,
    tailGirth: 1.3,
    legLength: 0.78,
    stance: 1.28,
    plateRow: 'double',
  },

  /** The sail is the animal. Long crocodile jaws under it. */
  sail: {
    length: 1.06,
    height: 1,
    girth: 0.9,
    headSize: 1,
    snout: 1.5,
    jaw: 0.3,
    neckReach: 0.14,
    tailLength: 1.18,
    tailGirth: 0.9,
    legLength: 1.04,
    plateRow: 'sail',
  },

  /** Head first, everything else in service of it. */
  rex: {
    length: 1,
    height: 1.06,
    girth: 1.02,
    headSize: 1.38,
    snout: 1.06,
    jaw: 0.42,
    neckReach: 0.06,
    neckRise: 0.08,
    tailLength: 1.02,
    tailGirth: 1.08,
    legLength: 1.12,
    plateRow: 'single',
  },

  /** Long-necked, long-tailed and thin through the body: a serpent on legs. */
  wyrm: {
    length: 1.14,
    height: 0.94,
    girth: 0.88,
    headSize: 0.96,
    snout: 1.2,
    jaw: 0.26,
    neckReach: 0.4,
    neckRise: 0.22,
    tailLength: 1.4,
    tailGirth: 0.82,
    tailDroop: 0.6,
    legLength: 1.06,
    plateRow: 'sail',
  },

  /** Slab-sided and enormous. The one that does not need to be quick. */
  colossus: {
    length: 1.06,
    height: 1.16,
    girth: 1.24,
    headSize: 1.16,
    snout: 0.94,
    jaw: 0.24,
    neckRise: -0.14,
    tailLength: 1.02,
    tailGirth: 1.25,
    legLength: 0.94,
    stance: 1.22,
    plateRow: 'double',
  },
}

/** Resolve a build name to a complete set of proportions. */
export function buildFor(shape) {
  return { ...DEFAULTS, ...(BUILDS[shape?.build] ?? BUILDS.rex) }
}

/** For tests and tooling: the knobs a build may set. */
export const BUILD_KNOBS = Object.keys(DEFAULTS)

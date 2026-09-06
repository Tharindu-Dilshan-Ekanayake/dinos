/**
 * The 13 evolution stages.
 *
 * `model` is the path to a GLB under /public (produced via
 * Tripo AI -> Blender cleanup -> Mixamo -> fbx2gltf). While it is `null` the
 * blocky placeholder dino is built from the shape flags below, so dropping a
 * real asset in is a one-line change here.
 *
 * `power` multiplies the player's damage.
 * `unlockAtWins` is measured against wins earned *this run* (not the spendable
 * balance, so buying upgrades never costs you a stage). A rebirth deliberately
 * resets you to Hatchling - that reset is what the permanent multiplier buys.
 *
 * Shape flags drive the placeholder geometry:
 *   build       which animal it is shaped like - see data/builds.js
 *   plates      number of back plates
 *   frill       neck shield, triceratops style
 *   horns       0-3 head horns
 *   tailSpikes  club/spikes on the tail tip
 *   crest       raised sail along the spine
 *   legs        2 for a biped, 4 for a quadruped stance
 *   glow        emissive strength for the late, magical stages
 *   pattern     how its markings are laid on - see DinoModel's torso builder
 *   mark        the colour those markings are drawn in
 *
 * `build` is what stops a "Stegosaur" from being a Rex with plates glued on.
 * The flags above dress a shape; the build *is* the shape - torso length, neck
 * carriage, head size, jaw, tail, leg length and stance - so a Triceratops is
 * front-heavy and low, a Raptor is long and quick, and a Hatchling is mostly
 * head. Thirteen silhouettes out of one mesh definition.
 *
 * A dino in one flat body colour reads as a toy. The stripe down a tiger or
 * the blotches on a gecko are most of what makes an animal look like a species
 * rather than a shape, so every tier carries a pattern and a second colour to
 * draw it in - which is also what stops thirteen tiers of the same silhouette
 * blurring into one another down the gallery.
 */
export const EVOLUTIONS = [
  {
    id: 'hatchling',
    build: 'hatchling',
    pattern: 'spots',
    mark: '#ffae2b',
    name: 'Hatchling',
    unlockAtWins: 0,
    power: 1,
    scale: 0.62,
    model: null,
    body: '#ffd23f',
    belly: '#fff6c9',
    spike: '#ff9f1c',
    aura: '#ffe27a',
    plates: 2,
    frill: false,
    horns: 0,
    tailSpikes: false,
    crest: false,
    legs: 2,
    glow: 0,
  },
  {
    id: 'raptor',
    build: 'raptor',
    pattern: 'stripes',
    mark: '#c85a12',
    name: 'Raptor',
    unlockAtWins: 20,
    power: 2.4,
    scale: 0.74,
    model: null,
    body: '#ff8c2b',
    belly: '#ffe3b0',
    spike: '#ffd93d',
    aura: '#ffb45c',
    plates: 3,
    frill: false,
    horns: 0,
    tailSpikes: false,
    crest: false,
    legs: 2,
    glow: 0,
  },
  {
    id: 'stego',
    build: 'stego',
    pattern: 'spots',
    mark: '#1f6fb8',
    name: 'Stegosaur',
    unlockAtWins: 55,
    power: 6,
    scale: 0.86,
    model: null,
    body: '#3fa7ff',
    belly: '#dff1ff',
    spike: '#ff5da2',
    aura: '#7cc4ff',
    plates: 6,
    frill: false,
    horns: 0,
    tailSpikes: true,
    crest: false,
    legs: 4,
    glow: 0,
  },
  {
    id: 'tricera',
    build: 'trike',
    pattern: 'ridge',
    mark: '#c73f18',
    name: 'Triceratops',
    unlockAtWins: 120,
    power: 15,
    scale: 0.95,
    model: null,
    body: '#ff6b35',
    belly: '#ffe0b8',
    spike: '#fff3c4',
    aura: '#ffa45c',
    plates: 3,
    frill: true,
    horns: 3,
    tailSpikes: false,
    crest: false,
    legs: 4,
    glow: 0,
  },
  {
    id: 'anky',
    build: 'anky',
    pattern: 'plated',
    mark: '#1d8a72',
    name: 'Ankylosaur',
    unlockAtWins: 260,
    power: 38,
    scale: 1,
    model: null,
    body: '#2fbf9f',
    belly: '#d6fff4',
    spike: '#ffd166',
    aura: '#5fe3c4',
    plates: 7,
    frill: false,
    horns: 1,
    tailSpikes: true,
    crest: false,
    legs: 4,
    glow: 0,
  },
  {
    id: 'spino',
    build: 'sail',
    pattern: 'stripes',
    mark: '#1a5f97',
    name: 'Spinosaur',
    unlockAtWins: 550,
    power: 95,
    scale: 1.08,
    model: null,
    body: '#2f8fd6',
    belly: '#d8f2ff',
    spike: '#ff9f45',
    aura: '#63c8ff',
    plates: 5,
    frill: false,
    horns: 1,
    tailSpikes: false,
    crest: true,
    legs: 2,
    glow: 0,
  },
  {
    id: 'rex',
    build: 'rex',
    pattern: 'stripes',
    mark: '#a8231d',
    name: 'Tyrant Rex',
    unlockAtWins: 1200,
    power: 240,
    scale: 1.18,
    model: null,
    body: '#f2453d',
    belly: '#ffd9d2',
    spike: '#ffc300',
    aura: '#ff7a5c',
    plates: 5,
    frill: false,
    horns: 2,
    tailSpikes: false,
    crest: false,
    legs: 2,
    glow: 0,
  },
  {
    id: 'magma',
    build: 'rex',
    pattern: 'ridge',
    mark: '#ff6a1a',
    name: 'Magma Tyrant',
    unlockAtWins: 2600,
    power: 650,
    scale: 1.26,
    model: null,
    body: '#5a2119',
    belly: '#ff8c1a',
    spike: '#ffe14d',
    aura: '#ff7a29',
    plates: 7,
    frill: false,
    horns: 2,
    tailSpikes: true,
    crest: true,
    legs: 2,
    glow: 0.55,
  },
  {
    id: 'frost',
    build: 'rex',
    pattern: 'plated',
    mark: '#4aa8de',
    name: 'Frost Sovereign',
    unlockAtWins: 5500,
    power: 1800,
    scale: 1.34,
    model: null,
    body: '#7fd4ff',
    belly: '#f4fdff',
    spike: '#ffffff',
    aura: '#c9f2ff',
    plates: 8,
    frill: true,
    horns: 3,
    tailSpikes: true,
    crest: false,
    legs: 2,
    glow: 0.4,
  },
  {
    id: 'storm',
    build: 'wyrm',
    pattern: 'stripes',
    mark: '#4436c9',
    name: 'Storm Wyrm',
    unlockAtWins: 12000,
    power: 5200,
    scale: 1.42,
    model: null,
    body: '#6f5cff',
    belly: '#dcd8ff',
    spike: '#ffe066',
    aura: '#a48cff',
    plates: 6,
    frill: false,
    horns: 2,
    tailSpikes: true,
    crest: true,
    legs: 2,
    glow: 0.7,
  },
  {
    id: 'venom',
    build: 'raptor',
    pattern: 'spots',
    mark: '#8fe02b',
    name: 'Venom Stalker',
    unlockAtWins: 26000,
    power: 15000,
    scale: 1.5,
    model: null,
    body: '#3f8f45',
    belly: '#ccff8f',
    spike: '#b6ff2e',
    aura: '#a8ff5c',
    plates: 8,
    frill: false,
    horns: 3,
    tailSpikes: true,
    crest: false,
    legs: 2,
    glow: 0.65,
  },
  {
    id: 'obsidian',
    build: 'colossus',
    pattern: 'plated',
    // Lighter than the body, not darker: obsidian is near black, so the only
    // marking that reads on it is one that glows off it.
    mark: '#c41d4c',
    name: 'Obsidian Colossus',
    unlockAtWins: 56000,
    power: 45000,
    scale: 1.6,
    model: null,
    body: '#2b2f47',
    belly: '#6b76a0',
    spike: '#ff2d64',
    aura: '#ff6b8a',
    plates: 9,
    frill: true,
    horns: 3,
    tailSpikes: true,
    crest: true,
    legs: 4,
    glow: 0.8,
  },
  {
    id: 'cosmic',
    build: 'rex',
    pattern: 'ridge',
    mark: '#8f6bff',
    name: 'Cosmic Apex',
    unlockAtWins: 120000,
    power: 140000,
    scale: 1.72,
    model: null,
    body: '#4a3fb0',
    belly: '#b39dff',
    spike: '#ffe066',
    aura: '#c9a3ff',
    plates: 10,
    frill: true,
    horns: 3,
    tailSpikes: true,
    crest: true,
    legs: 2,
    glow: 1,
  },
]

/** Highest stage unlocked at a given run-wins total. */
export function evolutionIndexForWins(totalWins) {
  let index = 0
  for (let i = 0; i < EVOLUTIONS.length; i++) {
    if (totalWins >= EVOLUTIONS[i].unlockAtWins) index = i
  }
  return index
}

/** The next locked stage, or null when maxed. */
export function nextEvolution(currentIndex) {
  return EVOLUTIONS[currentIndex + 1] ?? null
}

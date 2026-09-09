import { EVOLUTIONS } from './evolutions.js'
import { TREE_HALF_WIDTH } from './foliage.js'
import { TRAINING_PADS } from './training.js'

/**
 * Lobby hub layout.
 *
 * The hub is split down the middle: all thirteen stage podiums line the LEFT
 * side in two rows stepped like a staircase - seven at plaza level, six on a
 * raised tier behind them - and every training pad runs down the RIGHT side.
 * You spawn at the near end and the arena gate caps the far end.
 *
 * Every position and dimension lives here so the level can be re-laid-out
 * without touching a component.
 *
 * Axes: the plaza runs along -Z (away from the camera). +X is right.
 */

/* ------------------------------------------------------------------ ground */

export const PLAZA = {
  /** Walkable half-width and length of the paved area. */
  halfWidth: 34,
  from: 26,
  to: -56,
  /** Height of the raised path above the grass. */
  pathHeight: 0.25,
  /** Half-width of the central walkway stripe. */
  walkwayHalfWidth: 5,
}

/** Keeps the player inside the plaza without needing collision meshes. */
export const PLAYER_SPEED = 8.5
export const PLAYER_TURN_SPEED = 10

/** Where the player stands when the hub loads. */
export const PLAYER_SPAWN = [0, 0, 18]

/* ----------------------------------------------------------------- palette */

/*
 * The hub breathes the same air as the level at the top of its ramp.
 *
 * Sky, fog colour and fog distances used to be the hub's own - a paler blue
 * with haze starting six units further out than the Jungle Hollow's. Crossing
 * swapped one atmosphere for the other in a single frame, which washes the
 * whole screen a different colour at the exact moment you step through the
 * gateway. That colour pop *is* the "teleport effect": the geometry lines up,
 * and then the air changes. Matched to AREAS[0], the crossing has nothing left
 * to show.
 */
export const LOBBY_PALETTE = {
  skyTop: '#3f95e6',
  skyBottom: '#a9dcff',
  /*
   * Air, not soup.
   *
   * The old fog was a green the same weight as the grass, so distance did not
   * get paler, it got *greener* - and the far end of the hub read as a haze
   * lying on the field rather than as sky between you and it. Pale blue is what
   * the sky is already doing, so the two agree and the far trees simply thin
   * out.
   */
  fog: '#d6ecfa',
  fogNear: 54,
  fogFar: 420,
  /*
   * Grass a shade or two up from where it was. A toy world is lit like a toy
   * advert - the greens are bright and the shadows are shallow - and the hub
   * was carrying a forest green that made every clean surface next to it look
   * grey by comparison.
   */
  grass: '#8ee04a',
  grassDark: '#76cc39',
  /** Paving either side of the walkway. */
  path: '#b9c2cd',
  /** The lighter walkway running down the middle. */
  walkway: '#dde4ec',
  pathEdge: '#8e99a8',
  /*
   * The terraces that frame the plaza are pale sandy stone, not brown earth.
   *
   * Dirt sides under grass lids read as a hole dug in a field. The reference
   * hub is a *built* place - the green sits on courses of light stone the same
   * colour as the paving, which is what makes the whole bowl read as one
   * structure rather than as scenery dropped round a floor.
   */
  wall: '#c8cfc0',
  wallTop: '#adb6a2',
  /*
   * The two walls flanking the way into Stage 1 are the exception: dark slate,
   * not the pale stone everything else is built from.
   *
   * They are retaining walls in the same bowl, so matching them to it was the
   * obvious call and it is why the entrance vanished - a pale gateway set in a
   * pale terrace under a pale sky has no silhouette at all. Dark, they cut a
   * hard-edged slot out of a bright hub, and the eye goes to the one place the
   * game actually wants you to walk.
   */
  gateWall: '#4a5464',
  gateWallTop: '#38404d',
  /*
   * The rock the grass cliffs are cut from.
   *
   * Warm sandy stone, not the brown soil the terraces used to show down their
   * faces. Brown under green reads as a hole dug in a field; stone under green
   * reads as land standing up, which is the whole difference between a bank
   * beside the plaza and a cliff around it.
   */
  cliffRock: '#cbb894',
  cliffRockDeep: '#ab9878',
  /*
   * The way to the arena, in warm sandstone against the plaza's cold grey.
   *
   * The walkway used to be paved in exactly the material either side of it, so
   * the one route every run takes was invisible - a stone floor with a stone
   * stripe down it. A warm path on a cool concourse is the whole of the
   * wayfinding: you can see where the game wants you to go from the spawn
   * point, without a single sign.
   */
  pathStone: '#f2dfb4',
  pathKerb: '#c9ab74',
  pathMark: '#ffd166',
  key: '#fff6e0',
  ambient: '#cfe8ff',
}

/* ------------------------------------------------------------ left tier */

/**
 * The raised step carrying the back row of podiums, and the stairs up to it.
 * A single height lookup keeps the player's feet on whichever surface they are
 * standing on without needing terrain collision.
 *
 * It runs the length of the gallery it carries, so widening the spacing
 * between podiums lengthens this too - a back-row dino turning at the end of
 * the row must still have tier under it.
 */
export const LEFT_TIER = {
  minX: -31,
  maxX: -21.8,
  minZ: -30,
  maxZ: 17,
  height: 2.4,
}

export const LEFT_STAIRS = {
  minX: LEFT_TIER.minX,
  maxX: LEFT_TIER.maxX,
  /** Steps run from the plaza up to the tier's near edge. */
  fromZ: LEFT_TIER.maxZ,
  toZ: LEFT_TIER.maxZ + 4.8,
  steps: 4,
}

/** Surface height under a point: plaza, stairs, or the raised tier. */
export function groundHeightAt(x, z) {
  const ramp = rampHeightAt(x, z)
  if (ramp !== null) return ramp

  if (x >= LEFT_TIER.minX && x <= LEFT_TIER.maxX) {
    if (z >= LEFT_TIER.minZ && z <= LEFT_TIER.maxZ) return LEFT_TIER.height
    if (z > LEFT_STAIRS.fromZ && z <= LEFT_STAIRS.toZ) {
      const span = LEFT_STAIRS.toZ - LEFT_STAIRS.fromZ
      // Nearest the plaza is the bottom step; nearest the tier is the top.
      const t = 1 - (z - LEFT_STAIRS.fromZ) / span
      const step = Math.min(LEFT_STAIRS.steps, Math.floor(t * LEFT_STAIRS.steps) + 1)
      return (step / LEFT_STAIRS.steps) * LEFT_TIER.height
    }
  }
  return 0
}

/* ---------------------------------------------------------- stage podiums */

/** Spacing between podiums down each row. */
export const PODIUM_SPACING = 7.2

/**
 * How far a dino reaches from its own origin - the tip of a spiked tail.
 *
 * A podium dino turns on the spot, so this is the radius it sweeps, and it is
 * far larger than the pad under it: the model is nearly six units long against
 * a pad of four and a half.
 */
export const DINO_SWEEP_REACH = 4.26

/**
 * How far it reaches the other way - the tip of its snout.
 *
 * A dino is not centred on its own hip, which is where the podium used to turn
 * it: the tail is nearly three times as long as the head is deep, so the whole
 * animal orbited the pedestal instead of turning on it. Rotate about the
 * midpoint of the two and the circle it needs shrinks by a third.
 */
export const DINO_HEAD_REACH = 1.6

/** Where the model has to sit so the podium turns it about its own middle. */
export const DINO_CENTRE_OFFSET = (DINO_SWEEP_REACH - DINO_HEAD_REACH) / 2

/**
 * Half the animal's length, which is what it occupies once centred.
 *
 * It no longer turns - a podium dino stands facing the walkway, the way the
 * gallery in the game this is modelled on displays them - so this is a static
 * half-length along X rather than a swept radius. It is the same number either
 * way, which is why centring the model was worth doing before the spin went.
 */
export const DINO_HALF_LENGTH = (DINO_SWEEP_REACH + DINO_HEAD_REACH) / 2

/** And how wide it is across, which is all it needs between neighbours now. */
export const DINO_HALF_WIDTH = 0.75

/**
 * How big a dino stands on its podium, against its own scale.
 *
 * It was 0.62 turning about the hip, which had the late tiers sweeping four and
 * a half units on a row spaced six apart: they overlapped their neighbours by
 * nearly three units, hung off the tier they stood on, and swung their tails
 * through the retaining wall behind the front row. Dropping to 0.4 fixed that
 * by making them small.
 *
 * Turning them about their own middle instead buys back a third of the circle,
 * and that is what pays for this: 0.58 is nearly half again the size of 0.4 and
 * still clears the wall, the tier edge and the next podium along - see the
 * numbers in the layout test.
 */
export const PODIUM_DINO_SCALE = 0.78
/** First podium sits this far down the plaza. */
export const PODIUM_START_Z = 12
/** How close the player must stand to interact. */
export const INTERACT_RADIUS = 3.2

/**
 * Two rows on the left, stepped like a staircase: stages 1-7 at plaza level
 * and stages 8-13 on the raised tier behind them, so the whole progression is
 * visible from the walkway at once.
 */
export const PODIUM_ROWS = [
  { x: -18.5, y: 0, count: 7 },
  { x: -26.4, y: LEFT_TIER.height, count: 6 },
]

/**
 * `unlockAtWins` from data/evolutions.js doubles as the podium's requirement,
 * so the gallery and the unlock thresholds can never drift apart.
 */
export const PODIUMS = EVOLUTIONS.map((evolution, index) => {
  const row = index < PODIUM_ROWS[0].count ? 0 : 1
  const slot = row === 0 ? index : index - PODIUM_ROWS[0].count
  const def = PODIUM_ROWS[row]
  return {
    id: evolution.id,
    evolutionIndex: index,
    row,
    position: [def.x, def.y, PODIUM_START_Z - slot * PODIUM_SPACING],
  }
})

/* ----------------------------------------------------------- training pads */

export const TRAINING_PADS_LAYOUT = TRAINING_PADS

/**
 * Every training pad runs down the right-hand side of the plaza, out by the
 * fence rather than beside the walkway - the middle of the hub belongs to the
 * path between the gallery and the arena.
 */
export const TRAINING_ROW = {
  x: 26.5,
  startZ: 16,
  /*
   * Short enough that the last machine stops well clear of the entrance's
   * grass shoulder. The row used to run to z=-35.6 with the shoulder beginning
   * at -35, so the deepest treadmill was buried in a bank of grass.
   *
   * Each machine's base slab - the outermost of its three stacked layers, see
   * `PAD_WIDTH + 0.5` in TrainingPad.jsx - runs 4.5 wide along the row, half a
   * metre proud of the deck itself. Closing the gap to match the *deck*
   * exactly (4) left that base layer overlapping its neighbour's by the same
   * half metre - two machines' shadows and rims fighting for the same strip
   * of floor. Set to clear the base slab with real paving between them: close
   * enough to read as one row, open enough that every machine reads as its
   * own separate platform rather than a seam in a longer one.
   */
  spacing: -6,
}

export const TRAINING_POSITIONS = TRAINING_PADS.map((_, i) => [
  TRAINING_ROW.x,
  0,
  TRAINING_ROW.startZ + i * TRAINING_ROW.spacing,
])

/* ------------------------------------------------------- rebirth pedestals */

/** Rebirth milestones shown on the pedestal row. */
export const REBIRTH_PEDESTALS = [
  { rebirths: 1, label: 'x1.5 Power' },
  { rebirths: 3, label: 'x2.5 Power' },
  { rebirths: 5, label: 'x3.5 Power' },
]

/** Rebirth monuments stand in an arc across the entrance. */
export const REBIRTH_ROW = {
  z: 21.5,
  startX: -4,
  spacing: 7.5,
}

export const REBIRTH_POSITIONS = REBIRTH_PEDESTALS.map((_, i) => [
  REBIRTH_ROW.startX + i * REBIRTH_ROW.spacing,
  0,
  REBIRTH_ROW.z,
])

/* -------------------------------------------------------------- arena gate */

/** Portal at the end of the plaza that drops you into the battle arena. */
/**
 * The travel trigger, part-way up the staircase rather than at its foot, so
 * the climb between the walls actually reads before the scene changes.
 */
export const ARENA_GATE = {
  position: [0, 0, -45],
  radius: 1.6,
}

/* -------------------------------------------------------- arena entrance */

/**
 * The way out of the hub: a carpeted staircase climbing between two tall
 * retaining walls, with the arena beyond the top.
 *
 * The stairs are real geometry that `groundHeightAt` knows about, so the dino
 * physically walks up them, and the walls are backed by a short row of
 * collision circles so you cannot stroll around the side of the gateway.
 */
/*
 * The entrance sits at the far end of a longer plaza than it used to.
 *
 * Its retaining walls are ten units thick and start at `wallFromZ`, and the
 * gallery's last front-row podium was standing inside the left one - a
 * Tyrannosaur buried to the shoulder in coursed stone. Moving the whole
 * entrance back is what makes room for the gallery to move back with it, which
 * is the other half of the same problem: the row had nowhere left to go.
 */
export const ARENA_ENTRANCE = {
  /** Half-width of the walkable corridor between the walls. */
  gapHalfWidth: 5.2,
  wallWidth: 6,
  /**
   * Tall stone gate walls, scaled to frame the hub's main approach.
   *
   * Eight units was head-height on a dino and no more: from the plaza the two
   * walls read as a low kerb either side of a hole, and the way into Stage 1 -
   * the one door every run goes through - looked like a gap in a fence. At
   * thirteen they run off the top of the frame from anywhere on the concourse,
   * so the approach is a canyon you walk down and the doorway at the end of it
   * is the brightest thing in the shot.
   */
  wallHeight: 13,
  /** Walls run from the plaza end (near) to well past the stair top (far). */
  wallFromZ: -46,
  wallToZ: -58,
  /**
   * The way through to the arena. Flat.
   *
   * It was a flight of ten steps, then a ramp. Both are *seams*: they announce
   * that one place has ended and another is starting, and a climb also means
   * the hub and the arena sit at different heights - so crossing between them
   * had to move you vertically as well as horizontally, and no amount of
   * lining up the coordinates hides that.
   *
   * At zero rise the two halves of the game are one plane. `APPROACH_DROP`
   * falls out as zero, the walls stop tilting, and walking through the gateway
   * is walking down a corridor.
   */
  rampRise: 0,
  rampRun: 3.5,
  rampFromZ: -40.5,
  /**
   * Grass shoulder either side of the walls.
   *
   * Under the height a standing jump clears - `JUMP_SPEED` against `GRAVITY`
   * reaches about 2.06 - so the ledge either side of the gateway is somewhere
   * you can get up onto rather than a wall you bounce off.
   */
  shoulderHeight: 1.8,
}

/**
 * Where you are standing when you come back out of the arena.
 *
 * At the foot of the ramp, facing up the plaza - so a run ends where it began
 * and you walk home from the doorway you left by.
 *
 * It used to be wherever your *arena* coordinates happened to land. Walking
 * back out of Stage 1 leaves you around z=+10 in arena space, which is inside
 * the hub's bounds, so nothing repositioned you at all and you simply appeared
 * standing in the middle of the plaza with the entrance a long way behind you.
 */
/**
 * Also where the Hub button lands you - see `setScene` in useGameStore.js.
 * That button skips the walk, but it still arrives at the same door: a jump
 * that woke you up in the middle of the concourse instead read as a cut away
 * from the fight rather than as coming home.
 */
export const HUB_ARRIVAL = {
  position: [0, 0, ARENA_ENTRANCE.rampFromZ + 3],
  /** Facing +Z: up the plaza, with the ramp at your back. */
  angle: -Math.PI / 2,
}

/** Z of the top of the ramp, where it meets the arena's landing. */
export const ARENA_RAMP_TOP_Z = ARENA_ENTRANCE.rampFromZ - ARENA_ENTRANCE.rampRun

/**
 * The line where the hub stops being the hub: the middle of the gateway.
 *
 * There are two thresholds at this end of the plaza and they have to be the
 * same one. There is the one you can *see* - the lit pane hung between the two
 * walls, with Stage 1 lettered across it - and there is the one the game acts
 * on, where it stops drawing the hub and starts drawing the arena. They were
 * eight units apart: the handoff sat at the top of the ramp, two units before
 * the walls even begin, so you were handed to the arena out on the open
 * approach and then walked the whole length of the gateway, and through the
 * pane, already on the other side. What that looks like is the ground and the
 * walls around you being redrawn by a different set of components mid-stride -
 * the world blinking and coming back - a few paces short of the door.
 *
 * Both of them read this now. Crossing the glass *is* the crossing, which is
 * the only arrangement in which nothing visibly happens at all.
 */
export const ARENA_THRESHOLD_Z = (ARENA_ENTRANCE.wallFromZ + ARENA_ENTRANCE.wallToZ) / 2

/**
 * Keeps the player inside the plaza without needing collision meshes.
 *
 * `minZ` has to reach past the handover, or Stage 1 cannot be entered at all:
 * you walk to the end of your leash and stop, a few paces short of a line that
 * never fires. That has now happened twice - once when the handover moved from
 * a circle half-way up the ramp to the top of it, and again when it moved from
 * the top of the ramp to the pane hung between the walls - so it is written
 * against ARENA_THRESHOLD_Z itself rather than against whatever landmark the
 * handover happens to be standing on this month. Wherever the threshold goes,
 * the leash goes a metre further.
 *
 * Walking down there is only possible inside the gateway: the controller
 * squeezes X to the gap the moment you leave the plaza. See Player.jsx.
 */
export const PLAYER_BOUNDS = {
  minX: -PLAZA.halfWidth + 1.2,
  maxX: PLAZA.halfWidth - 1.2,
  minZ: ARENA_THRESHOLD_Z - 1,
  maxZ: PLAZA.from - 2,
}

/** How steeply the ramp climbs, for anything that has to lie on it. */
export const ARENA_RAMP_ANGLE = Math.atan2(ARENA_ENTRANCE.rampRise, ARENA_ENTRANCE.rampRun)

/**
 * Height of the ramp surface at a point, or null when off it.
 *
 * Linear, which is the whole point: the dino walks up a slope rather than
 * climbing ten discrete risers, so nothing about crossing into the arena reads
 * as crossing anything.
 */
export function rampHeightAt(x, z) {
  const e = ARENA_ENTRANCE
  if (Math.abs(x) > e.gapHalfWidth) return null
  if (z > e.rampFromZ || z < ARENA_RAMP_TOP_Z) return null
  return ((e.rampFromZ - z) / e.rampRun) * e.rampRise
}

/* --------------------------------------------------------------- collision */

/**
 * Solid props, as circles. The hub has no dynamic obstacles, so pushing the
 * player out of a handful of radii each frame is all the collision it needs -
 * far cheaper than putting the whole level into a physics world.
 *
 * Training pads are deliberately absent: you are meant to stand on those.
 */
export const PODIUM_RADIUS = 2.3
export const PEDESTAL_RADIUS = 1.8

/**
 * The entrance walls, as a row of circles down each inner face. Long slabs do
 * not fit the circle-push collision the hub uses, but a line of overlapping
 * circles along the face gives the same result for a fraction of the work.
 */
/*
 * The radius has to be half the wall, not a third of it.
 *
 * At three it covered only the inner six units of a wall ten units thick, so
 * you could walk into the outer half and stand inside coursed stone. Sized to
 * the wall and centred on it, a circle spans exactly the block it stands for -
 * pushing you out into the gateway on one side or onto the grass shoulder on
 * the other, whichever you came from.
 */
const ENTRANCE_WALL_RADIUS = ARENA_ENTRANCE.wallWidth / 2
const ENTRANCE_WALL_OBSTACLES = (() => {
  const out = []
  const e = ARENA_ENTRANCE
  const centre = e.gapHalfWidth + ENTRANCE_WALL_RADIUS
  // Overlapping, so there is no gap between one circle and the next to slip
  // through at the corners.
  const step = ENTRANCE_WALL_RADIUS * 0.6
  for (let z = e.wallFromZ; z >= PLAYER_BOUNDS.minZ - step; z -= step) {
    out.push({ x: -centre, z, radius: ENTRANCE_WALL_RADIUS })
    out.push({ x: centre, z, radius: ENTRANCE_WALL_RADIUS })
  }
  return out
})()

export const OBSTACLES = [
  ...PODIUMS.map((p) => ({ x: p.position[0], z: p.position[2], radius: PODIUM_RADIUS })),
  ...REBIRTH_POSITIONS.map((p) => ({ x: p[0], z: p[2], radius: PEDESTAL_RADIUS })),
  ...ENTRANCE_WALL_OBSTACLES,
]

/**
 * Pushes a point into the plaza's open space.
 *
 * Same reason as the arena's clamp: the terraces and the arena entrance walls
 * are single-sided boxes, so a camera swung into one sees through it and the
 * hub falls apart around the player.
 *
 * Mutates and returns the vector.
 */
export function clampToPlaza(point, margin = 1.2, player = null) {
  const halfWidth = PLAZA.halfWidth - margin
  if (point.x > halfWidth) point.x = halfWidth
  else if (point.x < -halfWidth) point.x = -halfWidth

  /*
   * The plaza's near end - behind the spawn, away from the arena - is where
   * the ground simply stops. Widening how far back and how steeply down the
   * camera is allowed to sit (see MAX_DISTANCE / maxLookDown) meant an orbit
   * pulled far enough behind the player now reached past that edge on its
   * own, with nothing built past it to see - a grey wall of backdrop
   * scenery seen from behind, filling half the shot.
   *
   * Pulled straight back toward the player along the same ray, not just
   * dropped onto the boundary Z: clamping Z alone leaves height untouched, so
   * near the boundary - which spawn sits close enough to that the *default*
   * view could trip it - the shot lost reach but kept its height and came out
   * far steeper than the pitch actually asked for, an accidental near-vertical
   * view standing in for whatever angle the player had chosen. Scaling the
   * whole offset keeps the angle the camera was actually given; the setback
   * is a squeeze, the same as the X clamp above, not a re-aim.
   *
   * The scale itself is floored, not left to run to zero. Standing right up
   * against the boundary - which `PLAYER_BOUNDS.maxZ` allows, only a hair
   * short of it - leaves almost no room on the ray at all, and an unfloored
   * scale collapsed the camera down onto the dino's own head: eye height,
   * looking straight up, the plaza gone and the whole shot just sky over a
   * sliver of ground. A floor of a third keeps the camera a third of its
   * normal reach out even at the worst of it - closer than usual, and no
   * longer the exact angle asked for, but still a shot of the plaza rather
   * than of the inside of the dino's own nose.
   */
  const zLimit = PLAZA.from - margin
  if (point.z > zLimit) {
    if (player) {
      const dz = point.z - player.z
      if (dz > 1e-4) {
        const scale = Math.max(0.34, (zLimit - player.z) / dz)
        point.x = player.x + (point.x - player.x) * scale
        point.y = player.y + (point.y - player.y) * scale
      }
    }
    point.z = zLimit
  }

  // Past the plaza's far end the only open ground is the gateway itself.
  if (point.z < ARENA_ENTRANCE.wallFromZ) {
    const gap = ARENA_ENTRANCE.gapHalfWidth - margin * 0.5
    if (point.x > gap) point.x = gap
    else if (point.x < -gap) point.x = -gap
  }

  return point
}

/* ----------------------------------------------------------------- scenery */

/**
 * Grass terraces stepping away from the plaza. Shared by the ground mesh and
 * the tree scatter so trees always stand on a step rather than floating.
 *
 * Five shallow steps, not three deep ones.
 *
 * Three of them climbed the same height in a third as many risers, so each
 * riser was a couple of metres of blank face twelve wide - and with the stone
 * courses that used to break those faces up gone, the bank beside the walkway
 * read as a plain grey wall with a green stripe along the top of it. The tops
 * are what carry everything (trees, tufts, toy blocks); the risers carry
 * nothing and never did. Cutting the same climb into more, smaller pieces puts
 * a grass line every metre up the slope, which is what makes it read as ground
 * rising rather than as a wall standing there.
 *
 * `offset` is how far out the step's centre sits. The last one has to stay
 * inside the perimeter wall at 73 or the hub's own enclosure ends up *behind*
 * its scenery - which is what a first step at `halfWidth + 61` was doing: 95,
 * twenty two units outside the wall, with its trees standing in the void past
 * the edge of the world.
 *
 * Everything that decorates them indexes `TERRACES` by `i % length`, so more
 * steps spreads the scatter further up the bank on its own.
 */
export const TERRACES = [
  { offset: PLAZA.halfWidth + 6, height: 1.6, width: 12 },
  { offset: PLAZA.halfWidth + 17, height: 3.6, width: 12 },
  { offset: PLAZA.halfWidth + 28, height: 6.2, width: 14 },
  /*
   * A fourth step, and the tallest.
   *
   * Three stopped at five and a half - below the perimeter wall at 73, so the
   * hub ended in a fence with open sky behind it. This one tops out above the
   * wall, which puts *land* behind the enclosure instead: you read a green
   * bowl the hub sits in rather than a yard with a fence round it. Its outer
   * face lands exactly on the wall, which is as far out as anything can go
   * before it is standing outside the world.
   */
  { offset: PLAZA.halfWidth + 34, height: 9.4, width: 10 },
]

/* ------------------------------------------------------------------ cliffs */

/** Thickness of the grass slab capping every cliff column. */
export const CLIFF_CAP = 0.9

/**
 * The voxel the cliff heights are quantised to.
 *
 * Heights are rounded to whole multiples of this, so the skyline the bank cuts
 * is a staircase rather than a slope. That rounding is the entire difference
 * between a blocky cliff and a lumpy hill: a continuous random height reads as
 * noise, and the very same randomness snapped to a grid reads as stacked
 * bricks.
 */
export const CLIFF_STEP = 0.55

/** How far a single cliff column runs along Z. */
const CLIFF_COLUMN_DEPTH = 5.5

/**
 * The stretch of hub the cliffs wrap.
 *
 * `CLIFF_FROM_Z` matches `PLAZA.from` exactly, which is where the old flat
 * terraces used to start - any further forward and the first column would
 * overlap the low apron RearGardenWall builds behind the spawn point.
 * `CLIFF_TO_Z` reaches past where the old terraces stopped, closer to the
 * arena-side perimeter wall at -73, so the cliffs frame the run-up to the
 * gate instead of leaving it flanked by bare grass.
 */
const CLIFF_FROM_Z = 26
const CLIFF_TO_Z = -68

/** How far a grass cap oversails the rock it sits on. */
const CLIFF_OVERHANG = 0.35

/**
 * The cliffs, as a run of columns per terrace.
 *
 * A terrace used to be one long box running the whole length of the plaza,
 * which from the walkway is a green stripe on a grey wall: the same silhouette
 * from every angle, and nothing to tell you how far along the hub you are.
 * Cutting each one into columns whose heights step by a fixed voxel gives the
 * bank a ragged top edge, a shadow that breaks as it climbs, and a different
 * profile from every point on the concourse.
 *
 * Built once at module load, because two separate things have to agree on it:
 * the geometry that draws the cliff, and `terraceSurfaceAt`, which every tree,
 * tuft and toy block is placed against. Generating it twice from one seed
 * would work right until someone reordered a call.
 */
function buildCliffColumns() {
  let seed = 5150
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  return TERRACES.map((terrace) => {
    const baseInner = terrace.offset - terrace.width / 2
    const outer = terrace.offset + terrace.width / 2
    const columns = []

    for (let z = CLIFF_FROM_Z; z > CLIFF_TO_Z; z -= CLIFF_COLUMN_DEPTH) {
      const depth = Math.min(CLIFF_COLUMN_DEPTH, z - CLIFF_TO_Z)
      /*
       * The face is ragged, but only ever *away* from the plaza.
       *
       * A column that stepped inward would stand inside PLAYER_BOUNDS, and
       * since `groundHeightAt` reports zero out here the dino would walk
       * straight into the side of it with nothing to stop it. Jittering
       * outward only means the cliff can be as broken as it likes and still
       * never reach ground anybody can stand on.
       */
      const inner = baseInner + Math.round(rand() * 3) * (CLIFF_STEP * 1.4)
      columns.push({
        centreZ: z - depth / 2,
        depth,
        height: terrace.height + Math.round(rand() * 3) * CLIFF_STEP,
        inner,
        outer,
      })
    }

    return columns
  })
}

export const CLIFF_COLUMNS = buildCliffColumns()

/**
 * The standable top of terrace `index` at `z` - grass cap included.
 *
 * Everything that sits on the bank is placed through this rather than against
 * `terrace.height`, because with a ragged top edge those two are no longer the
 * same number. Read the flat height instead and half the trees on a stepped
 * cliff are buried to the knee while the other half float above it.
 */
export function terraceSurfaceAt(index, z) {
  const columns = CLIFF_COLUMNS[index % CLIFF_COLUMNS.length]
  for (const column of columns) {
    const half = column.depth / 2
    if (z <= column.centreZ + half && z >= column.centreZ - half) {
      return column.height + CLIFF_CAP
    }
  }
  return TERRACES[index % TERRACES.length].height + CLIFF_CAP
}

/**
 * The cliffs as instancing items: rock bodies, and the grass slabs on top.
 *
 * Two lists rather than one, because they wear different materials and each is
 * drawn as a single InstancedMesh - so the whole ring of cliffs around the hub
 * costs two draw calls however many columns it gets cut into.
 */
export function lobbyCliffs() {
  const bodies = []
  const caps = []

  for (const columns of CLIFF_COLUMNS) {
    for (const column of columns) {
      const width = column.outer - column.inner
      const centreX = (column.inner + column.outer) / 2

      for (const side of [-1, 1]) {
        bodies.push({
          position: [side * centreX, column.height / 2, column.centreZ],
          scale: [width, column.height, column.depth],
        })
        /*
         * The cap oversails the rock on every side.
         *
         * Flush, a grass lid is just the top face of the block painted green.
         * Proud of it by a few centimetres it throws a shadow line the whole
         * way round the column, which is what makes the turf read as lying
         * *on* the rock rather than as being the same block in two colours.
         */
        caps.push({
          position: [side * centreX, column.height + CLIFF_CAP / 2, column.centreZ],
          scale: [width + CLIFF_OVERHANG, CLIFF_CAP, column.depth + CLIFF_OVERHANG],
        })
      }
    }
  }

  return { bodies, caps }
}

/**
 * Grass blades tufting the terraces that frame the plaza.
 *
 * They sit on the terrace tops only - never on the paving or the walkway - so
 * the hub gets the same overgrown edges as the arena without anything sprouting
 * where the player actually walks.
 */
export function lobbyTufts(clusters = 150) {
  const items = []
  let seed = 8112024
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  // Kept inside the run of cliff columns: past either end there is no bank to
  // stand on, and a tuft out there is a blade of grass hanging in mid-air.
  const fromZ = CLIFF_TO_Z + 3
  const spanZ = CLIFF_FROM_Z - 3 - fromZ

  for (let i = 0; i < clusters; i++) {
    const index = i % TERRACES.length
    const terrace = TERRACES[index]
    const side = i % 2 === 0 ? -1 : 1
    const cx = side * (terrace.offset + (rand() - 0.5) * (terrace.width - 1.5))
    const cz = fromZ + rand() * spanZ
    const top = terraceSurfaceAt(index, cz)

    const blades = 2 + Math.floor(rand() * 3)
    for (let b = 0; b < blades; b++) {
      const height = 0.5 + rand() * 0.5
      items.push({
        position: [cx + (rand() - 0.5) * 1.2, top + height / 2, cz + (rand() - 0.5) * 1.2],
        scale: [0.8 + rand() * 0.5, height, 0.8 + rand() * 0.5],
        rotation: rand() * Math.PI,
        tilt: (rand() - 0.5) * 0.2,
      })
    }
  }

  return items
}


/**
 * Bright toy blocks stacked around the hub's edges.
 *
 * The hub was green, grey and brown - honest, and a bit sober for a game about
 * cartoon dinosaurs. These are just stacks of primary-coloured cubes sitting on
 * the terraces, the way a box of bricks looks when it has been tipped out, and
 * they do more for the place than any amount of extra terrain would.
 *
 * `tone` indexes the colour list in the ground component; blocks are drawn one
 * instanced mesh per colour, so seventy of them cost five draw calls.
 */
export function lobbyBlocks(stacks = 46, tones = 5) {
  const items = []
  let seed = 90210
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  const fromZ = CLIFF_TO_Z + 3
  const spanZ = CLIFF_FROM_Z - 3 - fromZ

  for (let i = 0; i < stacks; i++) {
    const index = i % TERRACES.length
    const terrace = TERRACES[index]
    const side = i % 2 === 0 ? -1 : 1
    const cx = side * (terrace.offset + (rand() - 0.5) * (terrace.width - 3))
    const cz = fromZ + rand() * spanZ

    // One to three cubes, each a little smaller and turned off the one below.
    const height = 1 + Math.floor(rand() * 3)
    let base = terraceSurfaceAt(index, cz)
    let size = 1.5 + rand() * 0.9

    for (let level = 0; level < height; level++) {
      items.push({
        position: [cx + (rand() - 0.5) * 0.4, base + size / 2, cz + (rand() - 0.5) * 0.4],
        scale: size,
        rotation: rand() * Math.PI,
        tone: Math.floor(rand() * tones),
      })
      base += size
      size *= 0.78
    }
  }

  return items
}

/**
 * Blocky pines on the terraces, laid out deterministically.
 *
 * A screenful of trees is a forest, and the hub is not a forest - it is a
 * bright yard with trees standing round the edge of it. Thinned to where you
 * can see the terrace they are planted on.
 */
export function treeLayout(count = 26) {
  const trees = []
  let seed = 20240904
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  // The planted band is the cliff run, inset a little at both ends so no tree
  // stands on the last half-column with its canopy out over the drop.
  const fromZ = CLIFF_TO_Z + 4
  const spanZ = CLIFF_FROM_Z - 4 - fromZ

  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const index = i % TERRACES.length
    const terrace = TERRACES[index]
    const t = i / count
    const scale = 0.9 + rand() * 0.85
    // Inset by the canopy's own half-width, so no tree hangs over the terrace
    // edge with nothing underneath it.
    const room = Math.max(0, terrace.width / 2 - TREE_HALF_WIDTH * scale)
    const z = fromZ + spanZ * (1 - t) - rand() * 3

    trees.push({
      position: [side * (terrace.offset + (rand() - 0.5) * 2 * room), 0, z],
      // Read off the column this tree actually stands on - the tops are
      // stepped now, so one height for the whole terrace plants half the row
      // underground and floats the other half.
      terraceHeight: terraceSurfaceAt(index, z),
      /*
       * Which of the three shapes in data/foliage.js this one grows.
       *
       * A row of identical pines reads as wallpaper however much you jitter
       * the scale and spin - the silhouette is the thing the eye matches on,
       * and jitter does not change a silhouette. Three shapes in rotation,
       * offset by side so the two banks never mirror each other, is enough
       * that no two neighbours are the same tree.
       */
      kind: (i + (side > 0 ? 1 : 0)) % 3,
      scale,
      rotation: rand() * Math.PI,
    })
  }
  return trees
}

/* -------------------------------------------------------- approach path */

/**
 * The road from the spawn point to the arena doorway.
 *
 * Exactly as wide as the gap between the entrance walls, and deliberately so:
 * the path *is* the doorway, drawn all the way back up the plaza to where you
 * stand when the game loads. You do not have to be told where to go, because
 * the thing you are standing on runs there and is the only warm-coloured
 * surface in a hub paved in cold grey.
 *
 * It stops at the walls' near face. Past that the gateway takes over and the
 * floor is the arena's business.
 */
/*
 * The road is painted onto the concourse, not built up over it.
 *
 * A true raised slab has to agree with `groundHeightAt`, which reports zero
 * across the whole plaza - the same trap the concourse itself fell into once
 * already (see PLAZA.pathHeight's own history above). Zero new collision
 * surface to keep in step means drawing it the way the grass lanes are drawn:
 * flat overlays a few centimetres above the floor, biased forward in the
 * depth buffer with `DECAL_ABOVE`/`DECAL_TOP` rather than actually raised.
 */
export const APPROACH_PATH = {
  halfWidth: PLAZA.walkwayHalfWidth,
  /*
   * Starts just short of the spawn point, and behind the rebirth row.
   *
   * The monuments stand at z=21.5 with two of them inside the path's own
   * width, so a road starting any further back would run underneath them and
   * leave each one standing on a different-coloured floor than the one it was
   * placed on.
   */
  fromZ: PLAYER_SPAWN[2] + 1,
  toZ: ARENA_ENTRANCE.wallFromZ,
  /** Paint height above the concourse - a hair, purely to win the depth test. */
  rise: 0.03,
  /** The border line down each edge, and how far above the road it sits. */
  kerbWidth: 0.6,
  kerbRise: 0.01,
}

/**
 * Chevrons laid into the path, pointing the way in.
 *
 * Two bars meeting on the centre line, drawn as low reliefs turned about Y
 * rather than as a painted texture - in a world made of moulded bricks an
 * arrow is a thing you could pick up, not a decal. Shallow enough that
 * walking over one is no different from walking over the kerb line beside it:
 * both are a few centimetres of relief sitting on a floor whose walkable
 * height never moves from zero. They are what make the path directional - a
 * plain strip of different-coloured floor tells you a route exists, and the
 * arrows on it tell you which end of it the game wants.
 */
export function pathChevrons() {
  const out = []
  // Arm reach across the path, and how far the tip runs ahead of the tails.
  const reach = APPROACH_PATH.halfWidth * 0.82
  const depth = 2.2
  const angle = Math.atan2(depth, reach)
  const length = Math.hypot(reach, depth)
  const thickness = 0.05

  for (let z = APPROACH_PATH.fromZ - 7; z > APPROACH_PATH.toZ + 5; z -= 9.5) {
    for (const side of [-1, 1]) {
      out.push({
        position: [side * (reach / 2), APPROACH_PATH.rise + thickness / 2, z - depth / 2],
        scale: [length, thickness, 0.8],
        // Rotating +X about Y by θ sweeps it toward -Z, which is the way in.
        rotation: side * angle,
      })
    }
  }

  return out
}

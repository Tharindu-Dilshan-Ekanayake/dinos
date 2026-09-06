# +1 Dino Evolution (clone)

A browser idle/clicker battler built with React Three Fiber. Original assets and
art only — this reproduces the *mechanic*, not any Roblox-owned art, audio,
trademarks or UI chrome.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build
npm run smoke        # boots the app in headless Chrome and fails on any error
npm run budget       # draw calls and triangles, per scene, per graphics preset
npm run shot         # render a PNG of the game into shots/ - see below
npm run server       # optional leaderboard server, ws://localhost:8787
```

## The loop

Walk the **hub** to equip a dino from the podium gallery, stand on a **training
pad** to earn permanent damage, then climb the **arena staircase** to fight.

The **arena** is walkable too: you control your dino directly, close the
distance on a pack of enemy dinos and fight them down. Clear stages for Wins,
spend Wins on upgrades, unlock evolution tiers, and eventually **rebirth** for
a permanent multiplier.

### Controls

| | |
| --- | --- |
| Walk | `WASD` / arrows, or the on-screen stick |
| Jump | `Space`, or the Jump button |
| Attack | Left click, or the Attack button |
| Look | Right-drag (one-finger drag on touch), wheel to zoom |
| Interact (hub) | `E`, or the Interact button |

Attacks only land inside `ATTACK_RANGE`, which is what makes the arena a place
you move through rather than a button you hold from the doorway. **Auto Fight**
swings for you but still respects range, so positioning keeps mattering.

### A run, not a save point

Every trip into the arena **starts at Stage 1**. How far you got last time is
not a checkpoint - what you keep is the Wins you carry out.

- Clearing a level adds its reward to the Wins you are **carrying**, shown as
  the `Carried` chip. Carried Wins are not spendable yet.
- Two **Return pads** appear at the end of a cleared level. Stand on one and
  **press E** to bank everything you are carrying and walk back to the hub.
  Stepping on a pad used to be enough by itself, which put the most
  consequential move in a run - ending it - one wrong square away on the walk to
  the next gate. It raises the same "Press E" panel the hub uses for its
  podiums, tappable cap and all, so a phone has the same control a keyboard
  does.
- Walking back out through the **near end** of a chamber retreats one level at a
  time; doing it in Stage 1 leaves the arena and banks the run. There is no menu
  shortcut home - the way out is the way you came.
- **A level you cleared stays cleared for the whole run.** Walk back through it
  and its pack is still down; a fight you broke off mid-way is still half-fought
  when you return. The run remembers the corridor in `chamberHealth`, which is
  persisted with the rest of the save so a reload does not restock it.
- **Dying loses everything you were carrying.** That is what makes the Return
  pads a real decision: cash out now, or push one more gate. It sends you
  **straight back to the hub** - there used to be a panel with a skull, a
  paragraph and a button to acknowledge it, which made the cheapest moment in
  the game the one that asked most of you. What the run cost is thrown up as a
  floating number like every other number here; the only wait is the second your
  dino takes to go down, because cutting away mid-fall would leave you in the
  hub with no idea what happened.

  **Going down is three beats, not one lerp.** A death used to be a single
  rotation to 86 degrees over nine tenths of a second, which read as a model
  being turned rather than an animal being killed. Now the blow rocks it back
  onto its heels with its head thrown up (`DEATH_STAGGER`), it goes over
  sideways *accelerating* the way a falling thing does (`DEATH_TOPPLE`), and
  then it lands - a rebound, a squash, the legs splaying out from under it and
  the tail flopping after the head. The landing is the beat that sells it,
  because it is the only one with any weight in it. The clock runs off the
  store's own `dead` rather than an event, so a respawn puts the dino back on
  its feet by simply not being dead any more.

The **Levels** panel is therefore a read-only progress board and damage
reference, not fast travel - jumping straight to Stage 40 would undercut the
entire walk.

### The corridor

Levels are chambers laid **end to end along -Z**, chamber `k` at world
`-k * CHAMBER_SPAN`. Nothing is ever teleported: you walk out of one level,
through the gap in its back wall, and into the next. Crossing a boundary only
changes which chamber the bounds are anchored to, and those bounds overlap by a
passage length so the clamp never yanks you back into the level you just left.

Which level you are in is a **fact about where you are**, not something a
trigger decided on the way past: `stageTravelTarget()` compares the dino
against the two planes that bound its chamber and `ArenaTravel` hands the
answer to the store each frame. That one rule is what makes the corridor
walkable in reverse - the gates used to own a direction each and fire on
proximity, so stepping back through an open exit ran the *forward* one again
and pushed you into the level you were trying to leave. The gates are now a
door and a sign; they travel nobody.

The wall standing in front of chamber `k` is chamber `k-1`'s **back wall** - the
same wall, seen from the other side, and the doorway you look back through into
the level you came from.

**Three chambers stay mounted either side of the one you are in**
(`CHAMBERS_BEHIND` / `CHAMBERS_AHEAD`), so from Stage 3 you can see 4, 5 and 6
through the open gate and 2, 1 and the hub back through the entrance. Only one
was ever mounted ahead, so the corridor genuinely stopped a doorway in front of
you and the next level was built from scratch as you crossed into it.

Seeing them takes four things agreeing, and they are all derived from
`CORRIDOR_SIGHT` and `HORIZON_DISTANCE` in `data/weather.js` so they cannot
drift apart: the chamber has to be **mounted**, inside the **fog** (`fogFar`
now reaches past three chambers), in front of the **skyline** (which moved from
88 out to 240 and scaled up by the same factor, so it subtends exactly the
angle it always did rather than standing in the middle of the corridor), and
inside the camera's **far plane** (140 clipped the far end of the corridor
clean away; it is 460 now).

Chamber zero has no chamber before it, so it gets a wall of its own from
`buildArenaMouth()` - the arena's mouth, built as the back wall's mirror - and
`buildHubApproach()` builds what you see through it: the flight of steps you
climbed to get in, and the hub at the bottom of them. That is scenery, not
level; you leave through the doorway a few paces short of the top step. It is
built from the **hub's own measurements** (`ARENA_ENTRANCE`, `PLAZA`, `PODIUMS`,
`TRAINING_POSITIONS`, shifted by `LOBBY_Z_OFFSET` and dropped by
`APPROACH_DROP`), so the staircase you look down is the staircase you climb and
the podiums are where you left them. Chamber zero's floor slab runs out to
`APPROACH_EDGE_Z` to meet it, and the bedrock plane stops there too - at the
arena's own floor level it would bury the whole view.

**Every level has its own palette.** `paletteForStage()` takes the biome's
colours and shifts them a little further with each level inside it,
deterministically. Stage 6 is recognisably the same jungle as Stage 5 but
visibly not the same room, and because the chamber ahead is already mounted you
see its colours through the open gate before you walk into them.

The exit gate is **sealed until the chamber is clear** - the barrier is
literally the edge of the world until the last enemy falls. It never leaves,
though: it turns from red to blue and thins out, and carries the stage ahead
and its recommended damage lettered on both faces.

**Any gate can be walked through.** Stepping into a level you were underpowered
for used to kill the dino on the spot, before it had swung once - which made
the requirement a wall with a trap behind it rather than something to test
yourself against. The level itself is the test now, and the number on the gate
is what it tests you against:

- **Blows land in proportion to how ready you are.** `_applyDamage` scales by
  `min(1, clickPower / recommendedDamage)` *squared*, so at half the bar a hit
  lands a quarter. Meeting the bar is full damage and there is no bonus above
  it - raw click power already grows, so this only ever takes away.
- **`enemyBite` already scales the other way**, biting hardest on a level you
  have no business in.

Together they make the bar real: `gearing.test.mjs` runs the actual damage
pipeline against the actual bite rates and finds that at 25%, 50% and 75% of a
stage's bar **the pack wins every time**, in two to five seconds - while at the
bar you win in about five and a half with roughly half your health left. Lose
and you wake in the hub, the same as any other death.

And until you do, **breaking off is always available.** Walk back out through
the gate you came in by: the level behind is still cleared, everything you are
carrying is still carried, and the pack you fled cannot follow - enemies are
clamped to their own chamber, leaving a whole wall between them and you.

### Enemy packs

Pack size cycles 3-7 per level so the rhythm of a run varies, and a boss stage
fields one large dino alone. Rather than give each enemy its own health value,
the pack divides the stage's single health pool into bands - so rewards, gating,
saves and the damage pipeline all stay untouched, and the pack visibly thins as
the pool drains.

**No two levels field the same pack.** The line-up used to be
`slot % archetypes`, so slot 0 was a runner in Stage 1 and a runner in Stage 25
with the same attack on the same cooldown - the twentieth pack you fought was
the first pack in different colours. `enemyArchetype(stage, slot)` rotates the
roster by the level and strides through it; the roster is seven shapes and seven
is prime, so every stride walks the whole list before repeating. No pack fields
the same shape twice, and 25 levels produce 25 different line-ups.

**The whole pack fights you at once.** Each enemy takes a post on a ring around
the player and bites on its own cooldown, and the health numbers in `combat.js`
are tuned for exactly that. The formation did not agree: every enemy that was
not the one you were hitting stood 4.1-5.0 units out, while a bite carries 3.06
and a slam 2.89 - so most of the pack stood just outside the range at which it
was allowed to do anything, and the fight arrived one dino at a time. A post is
now measured against **that enemy's own reach** (`POST_WITHIN_REACH`), so a
shape that has to be on top of you comes and stands on top of you, and a
fire-breather still hangs back and breathes across the gap because it can. The
one you are fighting still pushes in closest, which keeps the target readable in
a scrum.

**And you can see which of them is hitting you.** The pack used to attack by
emitting particles: a cloud of fire appeared in front of a sailback that had not
moved a muscle, so a flurry from five of them read as weather rather than as
five animals. Every blow now has a wind-up and a pose. `ATTACK_WINDUP_SECONDS`
before the damage lands, the same cooldown emits `ENEMY_WINDUP`, and the enemy
gathers *backwards* into it - so anticipation and follow-through come off one
clock and the animation can never land on a different frame from the hit. Each
tell moves a different part of the animal: a lunge throws the whole body behind
the head, a claw rolls the shoulder and brings the head across, a tail sweep
turns the body away to bring the tail through, a slam rears up and comes down,
and a breath rears back and holds its ground while the fire does the travelling.
The pose is laid over the walk cycle rather than replacing it, so a dino still
closing on you can swing without stopping to play an animation first.

## Levels and damage gating

Stages open in order, and each one also states the click damage it is tuned for.

- `recommendedDamage(stage)` = the stage's health / `TARGET_CLICKS_TO_CLEAR`, so
  the advice can never drift from the actual health curve.
- `requiredDamage(stage)` is the entry bar a gate reads out. Nothing stops you
  walking through under it - the level itself is the refusal. Blows land at
  `readiness²`, where readiness is your click damage over the stage's
  recommendation, so at half the bar you do a quarter of your damage while the
  pack bites at its risky rate. The gearing suite fights it out and finds 25%,
  50% and 75% all unwinnable, and the bar itself a fight you win with about half
  your health left.
- `damageRating()` turns the ratio into Easy / Fair / Grindy / Too strong, which
  colours both the stage panel and the **Levels** board.

## Where to tune

All balance lives in `src/data/` — no numbers are hardcoded in components.

| File | Owns |
| --- | --- |
| `stages.js` | `BASE_HEALTH`, `GROWTH_RATE`, boss cadence, rewards, damage gating |
| `evolutions.js` | The 13 tiers: `unlockAtWins`, `power`, shape flags, colours |
| `progression.js` | `REBIRTH_WINS_REQUIRED`, rebirth multiplier, number formatting |
| `upgrades.js` | Shop costs and per-level effects |
| `training.js` | Training pad rates and rebirth gates |
| `areas.js` | The 5 biomes plus `paletteForStage()` per-level variation |
| `arena.js` | Chamber geometry, `CHAMBER_SPAN`, bounds, formations, attack range |
| `enemies.js` | Enemy body archetypes and per-biome colouring |
| `lobby.js` | Hub layout, podium rows, collision, scenery |

## Architecture notes

- **The Zustand store is the single source of truth.** Components are
  presentation-only and call store actions.
- **Effects go through an event bus** (`systems/events.js`), not React state.
  Particles, camera shake, floating text and SFX all subscribe there, so a fast
  clicker never re-renders the tree to show a hit.
- **Hot values are read imperatively.** Enemy health changes on every tap, so
  the health bar and 3D bar read the store from a frame loop and write straight
  to the DOM / object transforms.
- **Hit-stop** is a global time scale (`systems/timeScale.js`); every animated
  system multiplies its own delta by it, so the scene freezes together.
- **Rapier is scoped to stage-clear debris only.** Per-hit sparks go through a
  fixed-capacity instanced particle pool, which never allocates.
- **One movement controller** (`systems/playerMovement.js`) serves both the hub
  and the arena, so the dino handles identically in each. Neither scene puts the
  player in a physics world: clamping to bounds and pushing out of a few prop
  circles is cheaper and far more predictable.
- **Areas lerp by reference.** Materials hold the live palette `THREE.Color`
  instances, so one lerp per frame recolours the whole arena with no re-render.
  (Note: pass colours by assigning `material.color = c`; the constructor copies.)
- **The seam works from both sides.** The arena shows the hub down through its
  mouth (`buildHubApproach`) and the hub shows Stage 1 up its staircase — the
  *real* chamber, the same `Chamber` component the arena mounts, shifted into
  hub space by `APPROACH_DROP` / `LOBBY_Z_OFFSET`. The two mappings are exact
  inverses, the stairs land on the chamber floor with no step, and the mouth
  wall ends exactly on the seam, so what you look at from either end is what
  you arrive in.
- **One headline over the gate, everything else quiet.** `GateHeadline` hangs
  the destination above the gateway - "Defeat all enemies first!" with the
  head-count while the pack is up, then the stage ahead and its recommended
  damage. Its height and forward offset are tuned against the camera rig, not
  guessed: the title lands 15-24% down the screen from anywhere in the chamber
  and reads ~60px tall from the far end. It is the one piece of world text that
  never fades, because it is the destination.
- **Every chamber in sight has gates, not just the one you are in.** `Gates`
  walks the same `chamberWindow` the environment builds, so the levels ahead
  are levels rather than rooms with no way out and the ones behind still read
  as places you fought. **Each gate seals on its own chamber**, read straight
  out of the run's `chamberHealth`, so the levels ahead stand shut and the ones
  behind stand open - the corridor being several barriers deep is the run laid
  out in front of you. `active` marks only which gate talks to the HUD. The
  gateway sits in the *middle* of the wall it is cut through and the barrier
  hangs between its towers; against the near face they read as two towers and
  an unrelated pane of light.
- **The barrier is the gate's own sign.** It never slides away - it used to
  drop into the floor on a clear, taking the only thing that said where the
  doorway went with it. It stays lit across the gateway and changes state
  instead: **red while the level holds it shut, blue once it will let you
  through**, with the stage ahead and its recommended damage lettered onto both
  faces. Open, it thins from 0.6 to 0.2 opacity, because a doorway exists to be
  looked through and 80% of the next level still has to get past it.
  `GateHeadline` above it keeps only what the fight needs - "Defeat all enemies
  first!" and the head-count - so the two never say the same thing twice.
- **Idle damage only lands in reach.** Left ticking from anywhere it cleared
  every chamber a run had out-levelled before the player finished walking in -
  at 71K damage, a quarter of it per second, Stages 1 to 4 fell in under a
  second each. It now obeys the same reach a swing does.
- **Each shape fights its own way** (`ATTACK_STYLES`). A sailback breathes fire
  from further than you can hit back; a runner's teeth cannot reach you without
  closing; a shielded one hits half as often for half again as hard. Reach,
  cooldown and power *multiply* the shared numbers in `data/combat.js` so one
  set of tuning knobs still governs the whole fight, and `EnemyAttackEffects`
  draws the difference from a fixed instanced pool.
- **Both ends of a chamber stay empty.** The exit is two standing pillars and
  an opening; the entrance is two posts and a glow on the floor. Nothing spans
  either gap - no arch, no lintel, no plank, no strip painted down the
  gateway - because the whole value of the opening is that you can see the next
  level through it, and every marker tried there stood in front of the thing it
  was naming. Every solid piece of both gates is checked against
  `PASSAGE_HALF_WIDTH` so it cannot creep back into the walkway.
- **The camera reads the corridor as a continuous profile**
  (`corridorHalfWidthAt`). Read as a step - wide, then abruptly the width of a
  doorway - it threw the camera eight metres sideways the instant a boundary
  was crossed, which is precisely where a boundary is crossed. The taper runs
  *up to* a wall's face and is fully closed before the band begins, never the
  other way round, or the camera ends up inside geometry it is meant to be kept
  out of. A sealed gate still holds it back, but only while sealed - the old
  test asked whether the *player* was inside the hollow and switched off the
  moment they stepped into the passage, teleporting the camera ten metres. And
  where the walls squeeze it in, `LobbyCamera` gives up height rather than
  distance, so the shot never goes vertical.
- **Signs in the world fade with distance** (`systems/signage.js`). A chamber
  has four things with writing on them — the way on, the way back and two
  cash-out pads — and every one used to shout at full volume from anywhere in
  it, so standing at a gate meant the board in front of you, the sign at the
  far end and both pads stacked up the middle of the screen with the fight
  somewhere behind. A sign is drawn when you are close enough to act on it;
  only the *nearer* Return pad is ever labelled, since both offer the same
  deal. The exit arch itself never fades — it is what frames the next biome —
  only the writing on it. troika reads `fillOpacity` in its own
  `onBeforeRender`, so these are written per frame with no re-render and no
  `sync()`.
- **The entry gate carries no writing at all.** The camera orbits ~9 up and ~19
  back, so anything there sits between the lens and the level behind you. An
  arch blocked the chamber, a full-width plank landed mid-frame, and a
  waist-high signpost still stood squarely in front of the level it named. The
  way back needs no label - the level you came from is visible down the
  corridor, which is the whole point.
- **Arena numbers land on the enemy you hit.** The floating text falls back to
  the middle of the screen when nothing tells it better, which in the arena
  meant every `-damage` and every `+n 💪` piled up in the same spot no matter
  which of the pack you were fighting or where it stood. `ArenaCombat` projects
  the target through the camera and hands the pixel to `attack()`, so both
  numbers come out of the animal they belong to. Behind the camera the
  projection turns inside out, so that case says nothing and lets the number
  take its default place rather than throwing it off-screen.
- **Audio is synthesised** at runtime via Web Audio — no audio files ship.
  Footfalls are driven from the same `stride` phase that swings the legs
  (`systems/footsteps.js`), so a step is heard on the frame the foot is down;
  the whole pack shares one rate limit and fades with distance, because seven
  dinos running at you is otherwise white noise rather than footsteps.
- **The hub shows three levels up its staircase**, each with its own palette
  and its own gateway, so the climb leads to a run rather than to one room. Its
  sky dome had to grow with the view: at radius 100 it was smaller than the
  thing it contained, cutting Stage 1's far wall off at 110 units. Dome, clouds
  and sun all move out by one `SKY_SCALE` so the horizon still agrees with
  itself.
- **A podium dino is sized by the circle it sweeps, not by its pad.** They turn
  on the spot, and the model reaches 4.26 units behind its origin against 1.6 in
  front - so turned about its *hip*, as it was, the animal orbited its pedestal
  instead of standing on it. At 0.62 that meant a 4.5-unit radius on a row
  spaced 6.2: neighbours overlapping by nearly three units, dinos hanging off
  the tier and sweeping their tails through the retaining wall.
  `DINO_CENTRE_OFFSET` puts the axis through the animal's middle, which costs
  nothing and cuts the circle by a third - and that is what pays for
  `PODIUM_DINO_SCALE` being 0.58 rather than the 0.4 the hip pivot could
  afford. The hub was widened to 28 and both rows moved further left to make
  room for it.
- **The gallery outgrew the plaza.** Its last front-row podium stood inside the
  arena entrance's left retaining wall - a Tyrannosaur buried to the shoulder in
  coursed stone - because the row had grown down the plaza until it ran out of
  plaza. The entrance moved back fourteen units (`PLAZA.to`, `wallFromZ`,
  `stepFromZ` and the gate with it; `ARENA_STAIR_TOP_Z` and `LOBBY_Z_OFFSET`
  are derived, so the hub-arena seam followed on its own), which is what buys
  the room for both a wider `PODIUM_SPACING` and the gallery sitting further
  back. The layout test holds every podium against the tier wall, the tier
  edge, the entrance walls and the next podium along.
- **The wheel pulls back to 52 units, and does it proportionally.** It stopped
  at 38, close enough that the hub's podium row ran off both sides of the screen.
  What limits it is the *fog*, not the far plane: fog is measured from the
  camera, so a camera further from the player than the biome's fog near plane
  starts hazing over the player's own dino, which reads as a broken renderer
  rather than as distance. The marsh's fog starts closest at 42, and 52 leaves
  the dino about a tenth hazed there and clear everywhere else - the alternative
  was pushing the marsh's fog back, and a marsh that is not murky near you is
  not a marsh. Zoom scales the distance rather than adding to it, so one notch
  is always the same fraction of where you already are: a flat step is a nudge
  up close and a crawl far out, and over a range this size it would have been
  fifty notches end to end. It is nine.
- **The hub has a sign that says what the game is** (`HubBoard`). A hub with
  nothing in it naming the place is a field with props on it. A lit screen on
  two posts carries the title and either the shared standings or - with no
  server configured, which is most builds - your own records, because a
  permanently empty top-five is worse than no board. It stands over the
  treadmill row facing across it, since training is the longest anybody stands
  still in this game and that is therefore the wall worth putting a sign on. The
  bezel is split into ten segments in five arcade colours, each lit on its own
  beat so the strip reads as running round the screen rather than flashing - the
  same trick the machines below run down their rails. It only *listens* to the
  leaderboard; the HUD's panel owns the connection.
- **A treadmill is long, not square.** The pad used to be a 4.5m slab as wide as
  it was long, with rails down two sides and the console behind the runner's
  back - a dance floor with handrails. The deck now runs six metres along the
  belt and three across, which is the shape that reads as a treadmill from any
  angle and leaves a clear metre of grass between machines down the row. It has
  the parts a machine has: side rails either side of the belt, rollers at both
  ends, a motor housing, a console on uprights with an angled display and a row
  of buttons, and handrails running back from it onto a rear post. Local +Z is
  the way the dino faces while training, so the console is where a runner can
  read it and the sign has moved behind. The console was first hung as a
  two-metre slab at chest height, which from in front was a billboard with a
  treadmill hiding behind it; it is now carried high and kept small, because the
  belt is the thing you are meant to be looking at. Forty-odd boxes apiece
  across ten machines, merged into three draws.
- **Sparks run the rails** in each pad's own accent colour, drifting when the
  row is idle and sprinting under a dino. A machine that only changes
  *brightness* when you stand on it reads as a lamp; what says *running* is
  something with a direction to it. One instanced mesh per pad, so the whole row
  costs ten draws for the lot, and the row lights up as a ladder of colours
  rather than ten of the same machine.
- **Standing on a pad means standing on the belt.** The test was a circle of
  radius 2.1 round the middle, from when the pad was a square slab: it counted
  you while you stood on the *neighbouring* machine's edge and stopped counting
  you two metres up a belt you were still on. It is now the machine's own
  rectangle. That is also what freed the row - the machines sit 4.6 apart
  instead of 5.6, which is where the tenth one came from.
- **Two machines are free.** Everything past the second is gated on a rebirth,
  and before your first one a row of nine locked machines and one usable reads
  as a wall rather than as a gym.
- **Dressing is kept off the belt.** Several rung dressings lay their pieces
  round a *circle*, which was right for a square slab and put pieces on the
  running surface of a six-metre belt. `fitToRow` now pushes anything that would
  stand on the belt out into the band between it and the next machine.
- **The treadmills are turned a quarter turn**, so the belt runs across the row
  toward the walkway rather than along it - laid end to end they read as nine
  planks rather than a rank of machines, and the dino ran sideways down its own
  belt. That swaps which axis has to fit between neighbours, so `fitToRow`
  squeezes each pad's local **X**. Every pad also carries handrails and a
  console, which are the three things that make a machine read as a treadmill
  rather than as a lit slab, and the row moved out to `x: 19` by the fence -
  the middle of the hub belongs to the path between the gallery and the arena.
- **Locked is a state, not a repaint.** Locked tiers and locked pads used to be
  painted stone grey, which made the half of the hub you are working *toward*
  the half that told you nothing - six identical silhouettes and eight
  identical slabs. Everything now shows its own colours; what locking changes
  is whether it is **lit**. An unlit lamp is what "locked" looks like on a
  machine, and a dark unlit pad is what it looks like under a dino.
- **Every dino carries markings** - `pattern` (`stripes`, `spots`, `ridge`,
  `plated`) drawn in its own `mark` colour, as a sixth material group the
  merger picks up for free. One flat body colour reads as a toy; the stripe
  down a tiger is most of what makes a shape look like a species. Enemies get
  them too, in a deepened cut of the biome's body colour - *not* the accent,
  which is already their belly and their spikes. The looks test checks every
  marking actually reads against the body it is drawn on, which caught
  obsidian: a near-black dino wearing a near-black stripe.
- **Podium dinos stand still, facing the walkway**, the way the gallery they
  are modelled on displays them. Turning meant every one was showing you its
  flank or its tail half the time, and the circle a spinning dino needs is what
  kept them small: standing, what has to fit between podiums is its *width*
  rather than its length, which is what pays for `PODIUM_DINO_SCALE` being
  0.78. At that size a turning dino would sweep 11.4 units across a row spaced
  7.2.
- **The entrance is solid now.** Its stone walls are ten units thick and were
  collided with circles of radius three, covering only the inner six - you
  could walk into the outer half and stand inside coursed stone. The radius is
  the wall's own half-width, so a circle spans exactly the block it stands for.
  The grass ledges either side had no surface at all; `groundHeightAt` knows
  about them now, and `shoulderHeight` dropped to 1.8 because a standing jump
  reaches 2.06 - a ledge you cannot get onto is just a wall. The treadmill row
  used to run to z=-35.6 with that ledge beginning at -35, so its deepest
  machine was buried in a bank of grass; the row is shorter and stops clear.
- **A pad is worth the dino standing on it.** `padRate(pad, perClick)` is the
  dino's own damage per click times the pad's multiplier - a Stegosaur at +6 on
  the x2 pad earns 12/sec. It used to be a flat 0.8/sec times the multiplier,
  which made the first pad advertise `+0/sec` and made the whole row worth less
  the stronger your dino got, which is backwards for the thing you train on.
- **Training throws numbers too.** The HUD counter climbing on its own is easy
  to miss while you are watching your dino run, so training shouts `+n 💪` once
  a second, sized by the pad's multiplier - a second's *whole* earnings, not a
  per-frame crumb rounding to `+0`, and the same arm the click feedback uses
  because it is the same damage.
- **Standing on a training pad runs the dino.** The legs are driven by *effort*
  rather than travel (`playerActivity.training`), because a treadmill is the
  one place the dino works without going anywhere - it used to hold its idle
  pose while the belt scrolled under its feet and the damage counter climbed,
  with nothing connecting the two. It also **throws a blow on the beat** while
  it runs (`TRAIN_SWING_INTERVAL`), the same motion an attack makes in the
  arena, because damage on a pad is earned by attacking - a dino jogging
  politely while a number rises on its own says nothing about where the number
  comes from.
- **Each training pad is dressed differently** (`buildPadDecor`). Nine pads
  that differed only in colour read as one pad printed nine times; the row is
  meant to be a ladder you can see yourself climbing. The layouts are written
  without regard for spacing and squeezed to fit afterwards by `fitToRow`,
  because a pad has the whole lawn across the row and under three metres of it
  along the row.
- **Saves are debounced** to localStorage through `systems/persistence.js`, the
  single place storage is touched, and flushed on tab hide.
- **Each tier is its own animal** (`data/builds.js`). Every dino in the game
  used to be one barrel-chested body with things bolted on: the same torso,
  neck, head and tail whether it was called a Hatchling or a Triceratops, with
  colour and markings doing the entire job of telling them apart. A "Stegosaur"
  that is a Rex with plates glued on is not a stegosaur. A **build** is a set of
  proportions - torso length and girth, neck carriage, head size, snout length,
  jaw, tail, leg length, stance - written as multipliers on the shape the model
  already described, so `1` everywhere is exactly the old dino. Boxes take
  non-uniform scaling without complaint, so nine silhouettes cost the same as
  one did: a Hatchling is mostly head, a Raptor is long and low on tall legs, an
  Ankylosaur is the widest and lowest thing in the game, a Spinosaur has the
  sail and the crocodile jaws, and a Rex is the one with the mouth.
- **The lower jaw hangs on its own hinge**, so a dino can be caught mid-roar.
  It used to be a slab welded under the skull, which meant every animal in the
  game had its mouth shut - including the ones whose whole character is the size
  of what they can open. Each build sets a resting angle; the hinge is in the
  rig, so anything that wants to make one roar has a handle to pull.
- **Back plates come in three arrangements** (`plateRow`). A single row of
  blades was doing duty as a stegosaur's plates, a spinosaur's sail *and* a
  colossus's armour, which is why none of the three read as itself: `double`
  staggers two rows, `sail` joins the spines with a web so it reads as one fin,
  `single` is the old row, `none` is a smooth back.
- **Every dino stands on the floor rather than in it** (`data/stance.js`).
  `PrimitiveDino` claimed "feet on y = 0" in its own doc comment and had never
  been true: hips are hand-placed round numbers while a foot's reach below its
  hip falls out of the leg's *length*, and the two arithmetics never met. A
  biped's hind feet were 0.060 below the ground - most of a foot swallowed by
  the floor once multiplied by a late tier's scale - while a quadruped hovered
  0.042 over it and stood nose-up on its front claws, 0.022 higher again. The
  whole animal is now offset so its lowest foot lands on zero, which keeps every
  part where it was drawn relative to every other part, and a quadruped's
  shoulder is *derived* from the difference in leg length instead of chosen, so
  all four feet stay on one plane if a leg is ever retuned.

## What the ground does

A chamber used to be grass, rocks and a wall - a floor rather than a place. Each
biome now says what its **ground** does (`data/areas.js`), and it is one feature
either way: a shaped hole with something floating in it.

- **Jungle, ice and marsh get water**: a pond with a pale shallow shelf round
  its rim, lily pads on it, reeds standing in the edges and, two thirds of the
  time, a **plank walk across it**. The bridge is the one piece of scenery in a
  chamber that somebody *built*, which is what makes a level read as a place
  people pass through rather than as a landscape.
- **Volcano and the rift get lava, as a crust** (`crust`). The same shape read
  inside out: instead of a pool with things floating on it, the surface is tiled
  with slabs on a jittered grid, each cut a little short of its own cell and
  standing proud of the melt. What is left between them is a network of thin
  glowing lines - a rock floor with cracks through it, rather than an orange
  puddle with stepping stones in it. The bright shelf shrinks to a thin edge
  there too; at pond width it read as a sheet of yellow paper on the floor.

The outline is a handful of overlapping lobes rather than one rectangle, because
a rectangular pond reads as a swimming pool. **Fallen logs** lie across the floor
too - one long block with a snapped branch does more for a clearing than a dozen
more pebbles, because it is the only thing out there with a direction to it.

All of it is instanced: a whole waterway with its bridge is about seven draw
calls, and the arena went from 796 to 916 draw calls a frame for the lot.

Leaves hanging in off the ledges were tried here too, and taken back out: they
buried the terraces they were supposed to frame.

Two things this had to get right, both of them checked by `ground.test.mjs`:

- **Nothing is built where the game happens.** `blockedGround` asks about a
  *point*, which is right for a blade of grass and wrong for a pond - the centre
  of a pool can be well clear of the fighting pad while its far lobe lies across
  it. `fitsOnFloor` checks each piece with its own reach, against the pad, the
  doorway with its return pads, and the walls.
- **A level that asks for three pools gets three pools.** Placement is *tried*
  up to fourteen times rather than attempted once and abandoned, because the
  first version silently dropped a level's scenery whenever the first guess
  landed somewhere it could not go.
- **A bridge is a line, not a disc.** The first version asked whether a circle
  the length of the whole span would fit, which it never does, so no level in
  the game had a bridge and nothing said so. Each plank is checked where it
  actually lies, and the walkway is only laid if four fifths of it has somewhere
  to be - half a bridge is worse than none.

## Seeing it: `npm run shot`

Arithmetic can tell you a dino's feet land on zero. It cannot tell you whether
the dino looks like a dino. `npm run shot [name] [x y z] [targetX targetY targetZ]`
boots the real app in headless Chrome, points the camera and writes a PNG into
`shots/`. `SHOT_SCENE=arena` and `SHOT_STAGE=n` photograph a level instead of
the hub.

Two things make it work where `--screenshot` does not: headless Chrome never
composites, so `requestAnimationFrame` never fires and r3f's loop never runs
(frames are stepped by hand through `advance`), and the drawing buffer is not
preserved, so the canvas is read with `toDataURL` in the same task as the render
that filled it. Camera coordinates are chamber-local, because the corridor lays
levels forty units apart and Stage 18 is six hundred and eighty units down the
-Z axis.

It has already earned itself: the first pass at pool water rendered as a black
hole in the floor (a slightly metallic, low-roughness surface with no
environment map to reflect), and the second rendered white (the material block
declares its own local `ground` for the floor texture, which shadowed the biome
feature and handed every pool colour `undefined`). Neither is visible in a test
suite and both are obvious in a picture.

## Running on a weak machine

There are three graphics presets, picked automatically from the machine's core
and memory counts and overridable in Settings. Nothing about the game changes
between them - every level, prop and podium is where it always was - only how
much work is done to show it.

`npm run budget` is where the numbers come from: it boots the real app in
headless Chrome, drives it into each scene at each preset, and reads draw calls
and triangles off `WebGLRenderer.info`. Per frame:

| | draw calls | triangles |
|---|---|---|
| Hub, before any of this | 2,862 | 264K |
| Hub, High | 2,630 | 308K |
| Hub, Medium | 2,626 | 279K |
| **Hub, Low** | **1,720** | **165K** |
| Arena, High | 916 | 260K |
| **Arena, Low** | **742** | **121K** |

Both scenes have since been given more to draw - each tier its own animal with a
hinged jaw, and a floor with water, bridges, logs and overhanging leaves on it -
so the triangle counts are higher than the merging work left them. Draw calls
are what a weak machine runs out of first, and those are still below where they
started: the hub was 2,862 with one setting and is 1,720 on Low with everything
in it.

**No preset makes anything disappear.** An earlier version of this dropped the
podium dinos beyond a radius on Low and Medium, and walking the gallery meant
watching the far half of it wink out. That is a worse game, not a faster one -
the point of the row is to see what you are working toward. Every level, prop,
podium and dino is drawn at every setting; what changes is how much work goes
into drawing it. `perf.test.mjs` asserts no preset carries a hiding distance.

The draw-call column is the one that matters. Integrated graphics run out of
*submissions* long before they run out of triangles or pixels. So:

- **Boxes that were always drawn together are merged** (`MergedBoxes`). A
  treadmill's handrails, posts, console and bollards are sixteen meshes and
  there are nine treadmills; a fence run is a draw call per post. Welded per
  material they are a handful of buffers, and the picture is identical to the
  pixel. This is the version of "cheaper" that costs the player nothing, so it
  applies at **every** setting - it is most of why High got faster too. Shadow
  casting is part of the merge key, so a console slab still casts while the
  20cm rail beside it does not.
- **Shadows are a whole second render pass**, and dropping them takes a third
  of the hub's draw calls and nearly half its triangles with them. That is the
  one real difference Low makes, and it is the biggest single saving available.
  Medium keeps shadows at a 512 map - a quarter of the pixels to fill and to
  sample.
- **Scenery is built to a budget** (`detailCount`). Three chambers are mounted
  at once, so the arena's dressing is a few hundred instanced pieces per level;
  Low halves it, Medium takes a fifth off. It is all instanced, so this buys
  triangles and memory rather than draw calls - which is why it comes third.
- **Pixel ratio and antialiasing** come last, because a scene made of hard
  edges loses least by giving them up.

The hub's remaining cost is the gallery itself: twelve podium dinos at ~20
draws each, because each is a rigged animal whose legs and tail move. Merging
those would take the hub under a thousand calls, at the price of the podium
dinos becoming still statues. That is a look-and-feel decision, not a
performance one, so it has not been taken.

Two things that helped everywhere, at every setting:

- **The world no longer waits on a font.** drei's `<Text>` suspends while its
  font loads, and with no `font` given troika fetches Roboto from
  fonts.gstatic.com - every one of those sat inside the scene's single Suspense
  boundary, so the *entire 3D world* waited on a third-party download before
  drawing a triangle, and on a blocked or offline connection never rendered at
  all. `SceneText` gives each label its own boundary, which turns that from
  fatal to cosmetic: the world comes up at once, the writing arrives when it
  can.
- **Rails and bollards stopped casting shadows.** A shadow from a 20cm
  handrail is not worth a draw call on the shadow pass at any setting.

- **`npm run smoke` is what says the app works**, not `npm run build`. Vite only
  bundles - it resolves no names across modules, so a component referencing an
  import that was dropped builds perfectly and then throws the instant React
  renders it, leaving a blank page and a green build log. The smoke check boots
  the dev server, loads the app in headless Chrome, and fails on an empty root
  or on anything reaching `console.error`.

## Swapping in real GLB models

Tiers ship with `model: null` and render blocky placeholder geometry driven by
the shape flags. Drop a GLB into `public/` and set the path:

```js
{ id: 'rex', name: 'Tyrant Rex', model: '/models/rex.glb', ... }
```

`DinoModel.jsx` loads it with `useGLTF` behind a Suspense boundary and an error
boundary that falls back to the placeholder, so a missing or broken file never
blanks the canvas.

Asset pipeline: Tripo AI → Blender cleanup (Ctrl+J join, Ctrl+A apply
transforms, Merge by Distance) → Mixamo rigging → `fbx2gltf` → GLB.

## Leaderboard (optional)

Read-only and off by default. With no URL configured the panel is hidden
entirely and the game runs fully offline.

```bash
npm run server
VITE_LEADERBOARD_URL=ws://localhost:8787 npm run dev
```

Scores are self-reported, so this is a friendly scoreboard rather than an
authoritative ranking; anything stricter needs server-side simulation.
